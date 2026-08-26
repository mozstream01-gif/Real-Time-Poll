# Real-Time Poll — Backend Service

> **Servico de API REST + WebSockets (Socket.IO)** — Responsavel pela persistencia, integridade transacional contra votos concorrentes, gestao de presenca por salas e difusao (*broadcast*) em tempo real dos resultados agregados.

---

## Indice

- [Arquitetura do Backend](#arquitetura-do-backend)
- [Camada de Dados e Modelagem](#camada-de-dados-e-modelagem)
  - [Modelos e Associacoes](#modelos-e-associacoes)
  - [Prevencao de Voto Duplicado em Nivel de Banco](#prevencao-de-voto-duplicado-em-nivel-de-banco)
- [Endpoints REST](#endpoints-rest)
  - [`GET /health`](#get-health)
  - [`GET /api/polls/active`](#get-apipollsactive)
  - [`GET /api/polls/:id/results`](#get-apipollsidresults)
  - [`GET /api/polls/:id/my-vote`](#get-apipollsidmy-vote)
- [Protocolo WebSockets (Socket.IO)](#protocolo-websockets-socketio)
  - [Ciclo de Conexao e Salas (*Rooms*)](#ciclo-de-conexao-e-salas-rooms)
  - [Tabela de Eventos](#tabela-de-eventos)
  - [Metricas de Presenca em Memoria](#metricas-de-presenca-em-memoria)
- [Calculo Estatistico e Agregacoes](#calculo-estatistico-e-agregacoes)
- [Configuracao de Base de Dados (SQLite vs MySQL)](#configuracao-de-base-de-dados-sqlite-vs-mysql)
- [Scripts Disponiveis](#scripts-disponiveis)

---

## Arquitetura do Backend

O backend e organizado em 4 camadas bem desacopladas:

```mermaid
graph TD
    Client[Cliente Socket / REST] --> Entry[index.js - HTTP & Socket.IO Server]
    
    subgraph "Camada de Roteamento & Transporte"
        Entry --> RestRouter[routes/poll.routes.js]
        Entry --> SocketHandler[sockets/index.js]
    end

    subgraph "Camada de Negocio (Domain Service)"
        RestRouter --> PollService[services/poll.service.js]
        SocketHandler --> PollService
        SocketHandler <--> PresenceMap[Map: pollId -> Set of socketId]
    end

    subgraph "Camada de Persistencia (ORM)"
        PollService --> Models[db/models: Poll, PollOption, Vote]
        Models --> Connection[db/connection.js - Sequelize]
        Connection --> Storage[(SQLite file / MySQL Cluster)]
    end
```

---

## Camada de Dados e Modelagem

### Modelos e Associacoes

1. **`Poll`** (`polls`):
   - `id`: Chave primaria (`INTEGER`, Auto Increment).
   - `question`: Texto da pergunta (`STRING(255)`).
   - `isActive`: Flag booleana que indica se a votacao esta aberta a votos (`BOOLEAN`).
   - `createdAt`: Timestamp de criacao.

2. **`PollOption`** (`poll_options`):
   - `id`: Chave primaria (`INTEGER`, Auto Increment).
   - `pollId`: FK para `polls.id` com `onDelete: "CASCADE"`.
   - `label`: Nome da opcao (`STRING(120)`).
   - `color`: Codigo de cor hexadecimal para renderizacao no grafico (`STRING(20)`).

3. **`Vote`** (`votes`):
   - `id`: Chave primaria (`INTEGER`, Auto Increment).
   - `pollId`: FK para `polls.id` (`onDelete: "CASCADE"`).
   - `optionId`: FK para `poll_options.id` (`onDelete: "CASCADE"`).
   - `userId`: UUID persistente do browser (`STRING(64)`).
   - `userName`: Nome fornecido pelo utilizador (`STRING(120)`).
   - `createdAt`: Timestamp do voto.

---

### Prevencao de Voto Duplicado em Nivel de Banco

No modelo [`Vote.js`](file:///media/manhica/ManhicaIsley/Poll%20full/realtime-poll-full/backend/src/db/models/Vote.js#L36-L45), definimos uma restricao unica explicita:

```javascript
indexes: [
  {
    unique: true,
    fields: ["poll_id", "user_id"],
    name: "unique_vote_per_user_per_poll",
  },
]
```

- **Por que isso e critico?**
  Em sistemas distribuidos ou sob concorrencia (ex: utilizador clica 2x rapidamente, abre 2 abas ou envia requisicoes forcadas), verificacoes `SELECT WHERE userId = ...` sofrem de **Time-of-Check to Time-of-Use (TOCTOU)**.
  Com o indice unico a nivel de base de dados, o segundo `INSERT` e bloqueado com garantia ACID e dispara `UniqueConstraintError`.

---

## Endpoints REST

### `GET /health`
Verifica a disponibilidade do servidor HTTP.

- **Resposta (200 OK)**:
  ```json
  { "status": "ok" }
  ```

---

### `GET /api/polls/active`
Retorna a votacao ativa mais recente e a sua lista de opcoes (sem contagens agregadas).

- **Resposta (200 OK)**:
  ```json
  {
    "id": 1,
    "question": "Qual e a sua linguagem de programacao favorita?",
    "options": [
      { "id": 1, "label": "JavaScript", "color": "#3178c6" },
      { "id": 2, "label": "Python", "color": "#2f9e44" },
      { "id": 3, "label": "Java", "color": "#e8b400" },
      { "id": 4, "label": "PHP", "color": "#e64980" }
    ]
  }
  ```
- **Resposta (404 Not Found)**:
  ```json
  { "error": "Nao existe nenhuma votacao ativa no momento." }
  ```

---

### `GET /api/polls/:id/results`
Calcula e retorna os totais e percentagens consolidadas de uma votacao.

- **Resposta (200 OK)**:
  ```json
  {
    "pollId": 1,
    "question": "Qual e a sua linguagem de programacao favorita?",
    "totalVotes": 42,
    "options": [
      { "id": 1, "label": "JavaScript", "color": "#3178c6", "votes": 21, "percentage": 50.0 },
      { "id": 2, "label": "Python", "color": "#2f9e44", "votes": 14, "percentage": 33.3 },
      { "id": 3, "label": "Java", "color": "#e8b400", "votes": 5, "percentage": 11.9 },
      { "id": 4, "label": "PHP", "color": "#e64980", "votes": 2, "percentage": 4.8 }
    ]
  }
  ```

---

### `GET /api/polls/:id/my-vote?userId=xxx`
Verifica se o `userId` informado ja votou nesta votacao (utilizado na inicializacao para recuperar o estado sem esperar pelo socket).

- **Parametros Query**: `userId` (obrigatorio)
- **Resposta (200 OK)**:
  ```json
  { "hasVoted": true, "optionId": 2 }
  ```
  *(Se ainda nao votou: `{ "hasVoted": false, "optionId": null }`)*

---

## Protocolo WebSockets (Socket.IO)

### Ciclo de Conexao e Salas (*Rooms*)

Cada votacao possui uma sala isolada (`poll:${pollId}`). Ao conectar, o cliente junta-se a sala correspondente. Isto garante que votos na votacao 1 nao emitam mensagens para clientes visualizando a votacao 2.

```mermaid
stateDiagram-v2
    [*] --> Connected: Cliente estabelece conexao WS
    Connected --> InRoom: emit("poll:join", { pollId })
    InRoom --> Voting: emit("vote:cast", payload)
    Voting --> InRoom: emit("vote:success") + broadcast("results:update")
    InRoom --> Disconnected: Desconexao (socket.on("disconnect"))
    Disconnected --> [*]: Limpa presenca da memoria
```

---

### Tabela de Eventos

| Evento | Direcao | Payload | Descricao |
|---|---|---|---|
| `poll:join` | Cliente -> Servidor | `{ pollId: number }` | Registra o socket na sala `poll:ID` e envia o estado atual |
| `vote:cast` | Cliente -> Servidor | `{ pollId, optionId, userId, userName }` | Submete um voto |
| `vote:success` | Servidor -> Cliente | `{ optionId: number }` | Confirmacao de voto enviada apenas ao autor |
| `vote:error` | Servidor -> Cliente | `{ message: string, code?: string }` | Notificacao de erro (ex: `ALREADY_VOTED`) |
| `results:update` | Servidor -> Sala (`to(room)`) | `{ pollId, question, totalVotes, options[] }` | **Broadcast geral** com os totais recalculados |
| `presence:update` | Servidor -> Sala (`to(room)`) | `{ pollId: number, onlineCount: number }` | **Broadcast geral** com a quantidade de utilizadores online |

---

### Metricas de Presenca em Memoria

- A contagem de pessoas online e armazenada em memoria atraves de `Map<number, Set<string>>` onde a chave e o `pollId` e o valor e o `Set` de IDs de socket conectados.
- Ao desconectar (`disconnect`), o socket e removido do `Set` e o evento `presence:update` e emitido aos restantes participantes.

---

## Calculo Estatistico e Agregacoes

No ficheiro [`poll.service.js`](file:///media/manhica/ManhicaIsley/Poll%20full/realtime-poll-full/backend/src/services/poll.service.js#L39-L77), os resultados sao extraidos via query agregada com `GROUP BY`:

```javascript
const counts = await Vote.findAll({
  where: { pollId },
  attributes: ["optionId", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
  group: ["optionId"],
  raw: true,
});
```

A percentagem de cada opcao e calculada dinamicamente:
$$\text{percentage} = \frac{\text{votos da opcao}}{\text{total de votos}} \times 100$$
*(Arredondado a 1 casa decimal)*.

---

## Configuracao de Base de Dados (SQLite vs MySQL)

O backend possui suporte transparente e automatico tanto para **SQLite** como para **MySQL** configuravel pelo ficheiro `.env`:

### Modo SQLite (Padrao Local — Zero Config)
```env
DATABASE_URL="sqlite:./database.sqlite"
```
*(Nao requer instalacao de servidor externo; cria o ficheiro localmente)*.

### Modo MySQL (Producao / Cloud)
```env
DATABASE_URL="mysql://usuario:senha@localhost:3306/realtime_poll"
```

---

## Scripts Disponiveis

| Comando | Descricao |
|---|---|
| `npm run dev` | Inicia o servidor em modo de desenvolvimento com `nodemon` (auto-reload) |
| `npm start` | Inicia o servidor em modo de producao (`node src/index.js`) |
| `npm run seed` | Executa o script de seed criando a votacao de demonstracao |

