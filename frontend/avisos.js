// ---------- Texts: what the user reads when the server refuses something, the mode changes or a diagram will not open ----------
// Pure strings, no DOM. The caller writes them with textContent.
export const SIN_CONEXION = 'Sin conexión: recarga la página';

const AVISOS = {
  invalid_op: 'Un cambio fue rechazado por el servidor y se ha deshecho',
  op_limit: 'El diagrama alcanzó el límite de 5 000 operaciones',
  forbidden: 'Tu rol ya no permite editar este diagrama',
  not_found: 'Ya no tienes acceso a este diagrama',
  diagram_deleted: 'Este diagrama se ha borrado',
  gap: SIN_CONEXION, closed: SIN_CONEXION, network: SIN_CONEXION, load: SIN_CONEXION,
};
// An unknown key must not reach the user as "undefined": a refusal the app does not know is still a refusal
export const textoAviso = clave => AVISOS[clave] ?? 'El servidor rechazó un cambio';

const SOLO_LECTURA = {
  role: 'Solo lectura: tu rol no permite editar',
  deleted: 'Solo lectura: este diagrama se ha borrado',
  'no-access': 'Solo lectura: ya no tienes acceso',
};
// The label of the mode indicator: {mode: 'loading'|'edit'|'readonly'|'offline', reason}
export function textoModo(modo) {
  switch (modo?.mode) {
    case 'loading': return 'Conectando…';
    case 'edit': return 'Editando';
    case 'readonly': return SOLO_LECTURA[modo.reason] ?? 'Solo lectura';
    case 'offline': return SIN_CONEXION;
    default: return SIN_CONEXION;
  }
}

// Why a shared diagram did not open. A missing diagram and one the user is not a member of both arrive as 404 and
// read the same: the answer must not reveal that the diagram exists.
export function textoErrorApertura(error) {
  if (error?.status === 404) return 'No tienes acceso a este diagrama o no existe';
  if (error?.status === 410) return AVISOS.diagram_deleted;
  return SIN_CONEXION;
}
