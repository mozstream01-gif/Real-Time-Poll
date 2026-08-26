# ⚙️ Real-Time Poll — Backend Service

> **Serviço de API REST + WebSockets (Socket.IO)** — Responsável pela persistência, integridade transacional contra votos concorrentes, gestão de presença por salas e difusão (*broadcast*) em tempo real dos resultados agregados.

---

## 📑 Índice

- [Arquitetura do Backend](#-arquitetura-do-backend)
- [Camada de Dados e Modelagem](#-camada-de-dados-e-modelagem)
  - [Modelos e Associações](#modelos-e-associações)
  - [Prevenção de Voto Duplicado em Nível de Banco](#prevenção-de-voto-duplicado-em-nível-de-banco)
- [Endpoints REST](#-endpoints-rest)
  - [`GET /health`](#get-health)
  - [`GET /api/polls/active`](#get-apipollsactive)
  - [`GET /api/polls/:id/results`](#get-apipollsidresults)
  - [`GET /api/polls/:id/my-vote`](#get-apipollsidmy-vote)
- [Protocolo WebSockets (Socket.IO)](#-protocolo-websockets-socketio)
  - [Ciclo de Conexão e Salas (*Rooms*)](#ciclo-de-conexão-e-salas-rooms)
  - [Tabela de Eventos](#tabela-de-eventos)
  - [Métricas de Presença em Memória](#métricas-de-presença-em-memória)
- [Cálculo Estatístico e Agregações](#-cálculo-estatístico-e-agregações)
- [Configuração de Base de Dados (SQLite vs MySQL)](#-configuração-de-base-de-dados-sqlite-vs-mysql)
- [Scripts Disponíveis](#-scripts-disponíveis)

---

## 🏛️ Arquitetura do Backend

O backend é organizado em 4 camadas bem desacopladas:

```mermaid
graph TD
    Client[📱 Cliente Socket / REST] --> Entry[index.js - HTTP & Socket.IO Server]
    
    subgraph "Camada de Roteamento & Transporte"
        Entry --> RestRouter[routes/poll.routes.js]
        Entry --> SocketHandler[sockets/index.js]
    end

    subgraph "Camada de Negócio (Domain Service)"
        RestRouter --> PollService[services/poll.service.js]
        SocketHandler --> PollService
        SocketHandler <--> PresenceMap[Map: pollId -> Set of socketId]
    end

    subgraph "Camada de Persistência (ORM)"
        PollService --> Models[db/models: Poll, PollOption, Vote]
        Models --> Connection[db/connection.js - Sequelize]
        Connection --> Storage[(SQLite file / MySQL Cluster)]
    end
```

---

## 💾 Camada de Dados e Modelagem

### Modelos e Associações

1. **`Poll`** (`polls`):
   - `id`: Chave primária (`INTEGER`, Auto Increment).
   - `question`: Texto da pergunta (`STRING(255)`).
   - `isActive`: Flag booleana que indica se a votação está aberta a votos (`BOOLEAN`).
   - `createdAt`: Timestamp de criação.

2. **`PollOption`** (`poll_options`):
   - `id`: Chave primária (`INTEGER`, Auto Increment).
   - `pollId`: FK para `polls.id` com `onDelete: "CASCADE"`.
   - `label`: Nome da opção (`STRING(120)`).
   - `color`: Código de cor hexadecimal para renderização no gráfico (`STRING(20)`).

3. **`Vote`** (`votes`):
   - `id`: Chave primária (`INTEGER`, Auto Increment).
   - `pollId`: FK para `polls.id` (`onDelete: "CASCADE"`).
   - `optionId`: FK para `poll_options.id` (`onDelete: "CASCADE"`).
   - `userId`: UUID persistente do browser (`STRING(64)`).
   - `userName`: Nome fornecido pelo utilizador (`STRING(120)`).
   - `createdAt`: Timestamp do voto.

---

### Prevenção de Voto Duplicado em Nível de Banco

No modelo [`Vote.js`](file:///media/manhica/ManhicaIsley/Poll%20full/realtime-poll-full/backend/src/db/models/Vote.js#L36-L45), definimos uma restrição única explícita:

```javascript
indexes: [
  {
    unique: true,
    fields: ["poll_id", "user_id"],
    name: "unique_vote_per_user_per_poll",
  },
]
```

- **Por que isso é crítico?**
  Em sistemas distribuídos ou sob concorrência (ex: utilizador clica 2x rapidamente, abre 2 abas ou envia requisições forçadas), verificações `SELECT WHERE userId = ...` sofrem de **Time-of-Check to Time-of-Use (TOCTOU)**.
  Com o índice único a nível de base de dados, o segundo `INSERT` é bloqueado com garantia ACID e dispara `UniqueConstraintError`.

---

## 🌐 Endpoints REST

### `GET /health`
Verifica a disponibilidade do servidor HTTP.

- **Resposta (200 OK)**:
  ```json
  { "status": "ok" }
  ```

---

### `GET /api/polls/active`
Retorna a votação ativa mais recente e a sua lista de opções (sem contagens agregadas).

- **Resposta (200 OK)**:
  ```json
  {
    "id": 1,
    "question": "Qual é a sua linguagem de programação favorita?",
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
  { "error": "Não existe nenhuma votação ativa no momento." }
  ```

---

### `GET /api/polls/:id/results`
Calcula e retorna os totais e percentagens consolidadas de uma votação.

- **Resposta (200 OK)**:
  ```json
  {
    "pollId": 1,
    "question": "Qual é a sua linguagem de programação favorita?",
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
Verifica se o `userId` informado já votou nesta votação (utilizado na inicialização para recuperar o estado sem esperar pelo socket).

- **Parâmetros Query**: `userId` (obrigatório)
- **Resposta (200 OK)**:
  ```json
  { "hasVoted": true, "optionId": 2 }
  ```
  *(Se ainda não votou: `{ "hasVoted": false, "optionId": null }`)*

---

## ⚡ Protocolo WebSockets (Socket.IO)

### Ciclo de Conexão e Salas (*Rooms*)

Cada votação possui uma sala isolada (`poll:${pollId}`). Ao conectar, o cliente junta-se à sala correspondente. Isto garante que votos na votação 1 não emitam mensagens para clientes visualizando a votação 2.

```mermaid
stateDiagram-v2
    [*] --> Connected: Cliente estabelece conexão WS
    Connected --> InRoom: emit("poll:join", { pollId })
    InRoom --> Voting: emit("vote:cast", payload)
    Voting --> InRoom: emit("vote:success") + broadcast("results:update")
    InRoom --> Disconnected: Desconexão (socket.on("disconnect"))
    Disconnected --> [*]: Limpa presença da memória
```

---

### Tabela de Eventos

| Evento | Direção | Payload | Descrição |
|---|---|---|---|
| `poll:join` | Cliente → Servidor | `{ pollId: number }` | Registra o socket na sala `poll:ID` e envia o estado atual |
| `vote:cast` | Cliente → Servidor | `{ pollId, optionId, userId, userName }` | Submete um voto |
| `vote:success` | Servidor → Cliente | `{ optionId: number }` | Confirmação de voto enviada apenas ao autor |
| `vote:error` | Servidor → Cliente | `{ message: string, code?: string }` | Notificação de erro (ex: `ALREADY_VOTED`) |
| `results:update` | Servidor → Sala (`to(room)`) | `{ pollId, question, totalVotes, options[] }` | **Broadcast geral** com os totais recalculados |
| `presence:update` | Servidor → Sala (`to(room)`) | `{ pollId: number, onlineCount: number }` | **Broadcast geral** com a quantidade de utilizadores online |

---

### Métricas de Presença em Memória

- A contagem de pessoas online é armazenada em memória através de `Map<number, Set<string>>` onde a chave é o `pollId` e o valor é o `Set` de IDs de socket conectados.
- Ao desconectar (`disconnect`), o socket é removido do `Set` e o evento `presence:update` é emitido aos restantes participantes.

---

## 📊 Cálculo Estatístico e Agregações

No ficheiro [`poll.service.js`](file:///media/manhica/ManhicaIsley/Poll%20full/realtime-poll-full/backend/src/services/poll.service.js#L39-L77), os resultados são extraídos via query agregada com `GROUP BY`:

```javascript
const counts = await Vote.findAll({
  where: { pollId },
  attributes: ["optionId", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
  group: ["optionId"],
  raw: true,
});
```

A percentagem de cada opção é calculada dinamicamente:
$$\text{percentage} = \frac{\text{votos da opção}}{\text{total de votos}} \times 100$$
*(Arredondado a 1 casa decimal)*.

---

## 🗄️ Configuração de Base de Dados (SQLite vs MySQL)

O backend possui suporte transparente e automático tanto para **SQLite** como para **MySQL** configurável pelo ficheiro `.env`:

### Modo SQLite (Padrão Local — Zero Config)
```env
DATABASE_URL="sqlite:./database.sqlite"
```
*(Não requer instalação de servidor externo; cria o ficheiro localmente)*.

### Modo MySQL (Produção / Cloud)
```env
DATABASE_URL="mysql://usuario:senha@localhost:3306/realtime_poll"
```

---

## 📜 Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor em modo de desenvolvimento com `nodemon` (auto-reload) |
| `npm start` | Inicia o servidor em modo de produção (`node src/index.js`) |
| `npm run seed` | Executa o script de seed criando a votação de demonstração |

