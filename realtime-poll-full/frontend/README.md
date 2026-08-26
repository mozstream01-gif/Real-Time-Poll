# 🖥️ Real-Time Poll — Frontend Application

> **Interface Reativa em React 19 + Tailwind CSS 4** — Visualização dinâmica de votações em tempo real com renderização fluida de gráficos via Chart.js, sincronização de estado com Socket.IO e design system temático *Control Room*.

---

## 📑 Índice

- [Arquitetura do Frontend](#-arquitetura-do-frontend)
  - [Árvore de Componentes](#árvore-de-componentes)
  - [Máquina de Estados da Interface](#máquina-de-estados-da-interface)
- [Camada de Hooks Customizados](#-camada-de-hooks-customizados)
  - [`usePoll`](#usepoll)
  - [`useActivePoll`](#useactivepoll)
  - [`useFlashOnNewVote`](#useflashonnewvote)
- [Design System & Estilização (Tailwind CSS 4)](#-design-system--estilização-tailwind-css-4)
  - [Paleta *Control Room*](#paleta-control-room)
  - [Tipografia Estratégica](#tipografia-estratégica)
  - [Micro-Interações e Animações CSS](#micro-interações-e-animações-css)
- [Resiliência e Tratamento de Erros](#-resiliência-e-tratamento-de-erros)
- [Scripts Disponíveis](#-scripts-disponíveis)

---

## 🏛️ Arquitetura do Frontend

### Árvore de Componentes

```mermaid
graph TD
    App["App.jsx (Orquestrador de Estado)"]
    
    App --> NameEntry["NameEntry.jsx\n(Formulário de Entrada)"]
    App --> LiveBadge["LiveBadge.jsx\n(Status WS + Online Counter)"]
    App --> VotingPanel["VotingPanel.jsx\n(Opções Interativas de Voto)"]
    App --> ResultsChart["ResultsChart.jsx\n(Chart.js Bar Chart + Lista)"]

    App -.-> usePoll["hooks/usePoll.js\n(Socket.IO & REST Sync)"]
    App -.-> useActivePoll["hooks/useActivePoll\n(Fetch Poll Ativa)"]
    App -.-> useFlash["hooks/useFlashOnNewVote\n(Realce visual no voto)"]
```

---

### Máquina de Estados da Interface

O componente [`App.jsx`](file:///media/manhica/ManhicaIsley/Poll%20full/realtime-poll-full/frontend/src/App.jsx) atua como a máquina de estados central da aplicação:

```mermaid
stateDiagram-v2
    [*] --> Carregando: Montagem do App
    Carregando --> ErroPoll: Falha no fetch /api/polls/active
    Carregando --> SolicitarNome: Poll carregada, mas sem userName em localStorage
    Carregando --> PainelVotacao: Poll carregada, userName existe, myVoteOptionId == null
    Carregando --> GraficoResultados: Poll carregada, userName existe, myVoteOptionId != null

    SolicitarNome --> PainelVotacao: Nome submetido (setStoredUserName)
    PainelVotacao --> Votando: Clica numa opção (isVoting = true)
    Votando --> GraficoResultados: Socket emite "vote:success"
    Votando --> PainelVotacao: Socket emite "vote:error" (exibe mensagem de erro)
    
    GraficoResultados --> GraficoResultados: Socket emite "results:update" (animação de barras)
```

---

## 🪝 Camada de Hooks Customizados

### `usePoll`
Localizado em [`src/hooks/usePoll.js`](file:///media/manhica/ManhicaIsley/Poll%20full/realtime-poll-full/frontend/src/hooks/usePoll.js):
- **Responsabilidade**: Orquestra toda a comunicação WebSocket e a hidratação REST da votação.
- **Ciclo de Vida**:
  1. **Hidratação REST Imediata**: Ao montar, faz `fetch` para `/my-vote` e `/results`. Isso garante que o utilizador veja resultados e o estado "já votei" antes mesmo do handshake do WebSocket terminar.
  2. **WebSocket Handshake**: Instancia o cliente Socket.IO e emite `poll:join` logo após a conexão.
  3. **Event Listeners**: Escuta `results:update` (atualização dos dados), `presence:update` (contagem de utilizadores online), `vote:success` e `vote:error`.
  4. **Cleanup**: Desconecta o socket ao desmontar o componente ou mudar de `pollId`.

---

### `useActivePoll`
Localizado em [`src/App.jsx`](file:///media/manhica/ManhicaIsley/Poll%20full/realtime-poll-full/frontend/src/App.jsx#L10-L29):
- Efetua o `GET /api/polls/active` com proteção contra *race conditions* de cancelamento (`cancelled = true`).

---

### `useFlashOnNewVote`
Localizado em [`src/App.jsx`](file:///media/manhica/ManhicaIsley/Poll%20full/realtime-poll-full/frontend/src/App.jsx#L31-L53):
- Compara o snapshot anterior de resultados com o atual (`useRef(results)`).
- Quando os votos de uma opção específica aumentam, ativa um estado transitório `flashOptionId` por 500ms, disparando uma animação CSS de pulso na linha correspondente da legenda.

---

## 🎨 Design System & Estilização (Tailwind CSS 4)

A interface adota a estética industrial **"Control Room"** — inspirada em consolas de monitorização de missão crítica.

### Paleta *Control Room*
Definida em [`src/index.css`](file:///media/manhica/ManhicaIsley/Poll%20full/realtime-poll-full/frontend/src/index.css#L3-L22) usando `@theme` nativo do Tailwind CSS 4:

| Variável | Hex | Significado Semântico |
|---|---|---|
| `--color-bg` | `#12151B` | Fundo carvão profundo |
| `--color-surface` | `#1A1F27` | Cartões e containers elevados |
| `--color-surface-raised` | `#212733` | Hover states e inputs |
| `--color-border` | `#2A3140` | Bordas sutis de baixo contraste |
| `--color-signal` | `#35D48C` | **Verde-sinal exclusivo para status "AO VIVO"** |
| `--color-signal-dim` | `#1F5C41` | Seleção de texto e badges de voto |
| `--color-danger` | `#E5566B` | Erros e validações |

---

### Tipografia Estratégica
- **Títulos (`--font-display`)**: `Space Grotesk` (geométrica e imersiva).
- **Corpo (`--font-body`)**: `Inter` (máxima legibilidade).
- **Números e Badges (`--font-mono`)**: `JetBrains Mono` com `tabular-nums` para evitar saltos visuais durante a contagem em tempo real.

---

### Micro-Interações e Animações CSS
- `pulse-dot` e `pulse-ring`: Efeito de radar pulsante no badge `Ao vivo`.
- `bar-flash`: Realce de brilho quando novos votos são recebidos.
- Suporte total a `prefers-reduced-motion: reduce` para acessibilidade.

---

## 🛡️ Resiliência e Tratamento de Erros

1. **Proteção de Armazenamento Local (`localStorage`)**:
   Em [`src/lib/userId.js`](file:///media/manhica/ManhicaIsley/Poll%20full/realtime-poll-full/frontend/src/lib/userId.js), todas as leituras e escritas são envolvidas em blocos `try/catch`. Caso o utilizador esteja em modo de navegação ultra-restrita ou iframe sem permissões de storage, a aplicação gera um identificador volátil sem quebrar a execução.
2. **Prevenção de Render Warnings no React 19**:
   Inicialização de estados persistentes com *lazy initializers* (`useState(getUserId)`), respeitando o compilador do React 19.

---

## 📜 Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor Vite em `http://localhost:5173` |
| `npm run build` | Compila o bundle de produção na pasta `dist/` |
| `npm run lint` | Executa o linter ultra-rápido `oxlint` (0 erros / 0 avisos) |
| `npm run preview` | Executa o servidor local de visualização da build de produção |

