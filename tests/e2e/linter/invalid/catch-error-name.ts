export function test() {
  try {
    throw new Error("test");
  } catch (e) {
    console.log(e);
  }
}
