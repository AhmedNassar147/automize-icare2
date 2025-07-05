/*
 *
 * Helper: `checkIfLoginPage`.
 *
 */
const checkIfLoginPage = async (page) =>
  await page.evaluate(() => {
    const loginContrainer = document.querySelector(".login-page");
    const username = document.querySelector("#Input_Username");
    const password = document.querySelector("#Input_Password");
    return !!(loginContrainer && username && password);
  });

export default checkIfLoginPage;
