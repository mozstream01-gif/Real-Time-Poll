const USER_ID_KEY = "realtime-poll:user-id";
const USER_NAME_KEY = "realtime-poll:user-name";

/**
 * Devolve o identificador único deste utilizador/sessão, criando-o (e
 * persistindo-o em localStorage) na primeira visita. É este id que o
 * backend usa para garantir que a mesma pessoa não vota duas vezes,
 * mesmo depois de recarregar a página.
 */
export function getUserId() {
  try {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
  } catch {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export function getStoredUserName() {
  try {
    return localStorage.getItem(USER_NAME_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredUserName(name) {
  try {
    localStorage.setItem(USER_NAME_KEY, name);
  } catch {
    // Silently ignore storage failure
  }
}
