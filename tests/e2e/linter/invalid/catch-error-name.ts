// Invalid: catch error should be named 'error' not 'badName'
export function test() {
  try {
    throw new Error("test");
  } catch (error) {
    console.log(error);
  }
}
