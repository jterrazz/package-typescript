export const GROUND_FOLDERS = Object.freeze(['_fixtures', '_expected', '_seeds', '_requests']);

export const GROUND_GLOBS = Object.freeze(GROUND_FOLDERS.map((folder) => `**/${folder}/**`));

export const isGroundFolder = (name) => GROUND_FOLDERS.includes(name);
