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

// ---------- Managing diagrams: the list, creating, sharing and accepting an invitation ----------
export const AVISO_ENLACE_COPIADO = 'Enlace de invitación copiado';
export const AVISO_ENLACE_MANUAL = 'Copia el enlace de invitación';

// What went wrong with an action: `error` is what gestion-supabase.js threw (its `status`, or none when the server never answered).
// Accepting says the same for an unknown and an expired invitation, so the answer does not reveal which one it was.
export function textoGestion(accion, error) {
  const status = error?.status;
  switch (accion) {
    case 'crear': return 'No se pudo crear el diagrama';
    case 'lista': return 'No se pudo cargar tu lista de diagramas';
    case 'compartir':
      if (status === 403) return 'Solo el dueño puede invitar';
      if (status === 410) return AVISOS.diagram_deleted;
      return 'No se pudo crear el enlace de invitación';
    case 'renombrar':
      if (status === 422) return 'El título debe tener entre 1 y 200 caracteres';
      if (status === 403) return 'Tu rol no permite renombrar este diagrama';
      if (status === 410) return AVISOS.diagram_deleted;
      return 'No se pudo renombrar el diagrama';
    case 'borrar':
      if (status === 403) return 'Solo el dueño puede borrar el diagrama';
      return 'No se pudo borrar el diagrama';
    case 'aceptar':
      if (status === 404) return 'El enlace de invitación no es válido o caducó';
      if (status === 410) return AVISOS.diagram_deleted;
      return SIN_CONEXION;
    default: return SIN_CONEXION;
  }
}
