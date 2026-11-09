// Diagram type: UML state diagram
export const state = {
  name: 'Estados',
  shapes: {
    rect:    { label: 'Estado',            mm: (id,t)=>`state "${t}" as ${id}` },
    diamond: { label: 'Elección (choice)', mm: (id,t)=>`state ${id} <<choice>>` },
    ellipse: { label: 'Inicio / Fin [*]',  mm: null },  // rendered as [*]
  },
  // stateDiagram-v2 no admite `direction TD` (solo TB, BT, RL y LR): con TD dibuja "direction" y "TD"
  // como estados. El modelo guarda TD o LR para todos los tipos; aquí TD se escribe como TB.
  header: dir => `stateDiagram-v2\n  direction ${dir === 'TD' ? 'TB' : dir}`,
  edge: (a,b,t) => t ? `${a} --> ${b} : ${t}` : `${a} --> ${b}`,
  radius: 12,
};
