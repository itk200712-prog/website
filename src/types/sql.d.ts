// .sql / .html ගොනු string එකක් විදිහට import කරන්න (next.config.ts → webpack asset/source)
declare module "*.sql" {
  const content: string;
  export default content;
}

declare module "*.html" {
  const content: string;
  export default content;
}
