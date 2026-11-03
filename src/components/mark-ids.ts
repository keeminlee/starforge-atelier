// A fresh id for each WorkshopMark that defines one (the Walls' stone gradient), so two
// marks on one page never share an id. A module counter: unique within a build, and the
// same from one build to the next for the same pages.
let n = 0;
export const nextMarkId = (prefix: string) => `${prefix}-${++n}`;
