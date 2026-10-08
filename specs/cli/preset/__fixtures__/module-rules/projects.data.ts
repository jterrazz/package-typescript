export const PROJECTS = [{ slug: 'atlas' }];

export const projectNamed = (slug: string): unknown => PROJECTS.find((project) => project.slug === slug);
