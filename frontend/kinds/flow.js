// Diagram type: flowchart
export const flow = {
  name: 'Flujo',
  shapes: {
    rect:    { label: 'Proceso',    mm: (id,t)=>`${id}["${t}"]` },
    diamond: { label: 'Decisión',   mm: (id,t)=>`${id}{"${t}"}` },
    ellipse: { label: 'Inicio/Fin', mm: (id,t)=>`${id}(["${t}"])` },
  },
  header: dir => `flowchart ${dir}`,
  edge: (a,b,t) => t ? `${a} -->|${t}| ${b}` : `${a} --> ${b}`,
  radius: 4,
};
