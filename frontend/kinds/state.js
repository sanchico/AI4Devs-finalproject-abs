// Diagram type: UML state diagram
export const state = {
  name: 'Estados',
  shapes: {
    rect:    { label: 'Estado',            mm: (id,t)=>`state "${t}" as ${id}` },
    diamond: { label: 'Elección (choice)', mm: (id,t)=>`state ${id} <<choice>>` },
    ellipse: { label: 'Inicio / Fin [*]',  mm: null },  // rendered as [*]
  },
  header: dir => `stateDiagram-v2\n  direction ${dir}`,
  edge: (a,b,t) => t ? `${a} --> ${b} : ${t}` : `${a} --> ${b}`,
  radius: 12,
};
