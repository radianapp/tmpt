// app/dev/diagram/js/rendering/shapes.js

export const SHAPES = {
  rectangle: {
    getPath: (w, h) => `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`,
    ports: (w, h) => [
      { x: w / 2, y: 0, dir: 'N' },
      { x: w, y: h / 2, dir: 'E' },
      { x: w / 2, y: h, dir: 'S' },
      { x: 0, y: h / 2, dir: 'W' }
    ]
  },
  rounded: {
    getPath: (w, h) => {
      const r = Math.min(w, h) * 0.15;
      return `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    },
    ports: (w, h) => SHAPES.rectangle.ports(w, h)
  },
  ellipse: {
    getPath: (w, h) => {
      const rx = w / 2;
      const ry = h / 2;
      return `M 0 ${ry} A ${rx} ${ry} 0 1 1 ${w} ${ry} A ${rx} ${ry} 0 1 1 0 ${ry} Z`;
    },
    ports: (w, h) => SHAPES.rectangle.ports(w, h)
  },
  diamond: {
    getPath: (w, h) => `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`,
    ports: (w, h) => SHAPES.rectangle.ports(w, h)
  },
  parallelogram: {
    getPath: (w, h) => {
      const offset = w * 0.15;
      return `M ${offset} 0 L ${w} 0 L ${w - offset} ${h} L 0 ${h} Z`;
    },
    ports: (w, h) => SHAPES.rectangle.ports(w, h)
  },
  cylinder: {
    getPath: (w, h) => {
      const ry = Math.min(w, h) * 0.15;
      return `M 0 ${ry} A ${w / 2} ${ry} 0 0 1 ${w} ${ry} L ${w} ${h - ry} A ${w / 2} ${ry} 0 0 1 0 ${h - ry} Z M 0 ${ry} A ${w / 2} ${ry} 0 0 0 ${w} ${ry}`;
    },
    ports: (w, h) => SHAPES.rectangle.ports(w, h)
  },
  document: {
    getPath: (w, h) => {
      const wave = h * 0.08;
      const w4 = w / 4;
      return `M 0 0 L ${w} 0 L ${w} ${h - wave} Q ${w - w4} ${h - wave * 2} ${w / 2} ${h - wave} Q ${w4} ${h} 0 ${h - wave} Z`;
    },
    ports: (w, h) => SHAPES.rectangle.ports(w, h)
  },
  hexagon: {
    getPath: (w, h) => {
      const offset = w * 0.15;
      return `M ${offset} 0 L ${w - offset} 0 L ${w} ${h / 2} L ${w - offset} ${h} L ${offset} ${h} L 0 ${h / 2} Z`;
    },
    ports: (w, h) => SHAPES.rectangle.ports(w, h)
  },
  // Cloud & C4 / Special
  cloud: {
    getPath: (w, h) => {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${rx * 0.3} ${ry * 1.5} 
              A ${rx * 0.4} ${ry * 0.4} 0 0 1 ${rx * 0.2} ${ry * 0.8}
              A ${rx * 0.5} ${ry * 0.5} 0 0 1 ${rx * 0.9} ${ry * 0.3}
              A ${rx * 0.6} ${ry * 0.6} 0 0 1 ${rx * 1.8} ${ry * 0.6}
              A ${rx * 0.4} ${ry * 0.4} 0 0 1 ${w} ${ry * 1.2}
              A ${rx * 0.3} ${ry * 0.3} 0 0 1 ${rx * 1.7} ${ry * 1.7}
              Z`;
    },
    ports: (w, h) => SHAPES.rectangle.ports(w, h)
  },
  c4_person: {
    getPath: (w, h) => SHAPES.rounded.getPath(w, h),
    ports: (w, h) => SHAPES.rectangle.ports(w, h)
  },
  c4_system: {
    getPath: (w, h) => SHAPES.rectangle.getPath(w, h),
    ports: (w, h) => SHAPES.rectangle.ports(w, h)
  },
  db_table: {
    getPath: (w, h) => SHAPES.rectangle.getPath(w, h),
    ports: (w, h) => SHAPES.rectangle.ports(w, h)
  }
};
