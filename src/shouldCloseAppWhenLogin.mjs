/*
 *
 * Helper: `shouldCloseAppWhenLogin`.
 *
 */
import createConsoleMessage from "./createConsoleMessage.mjs";
import getLoginErrors from "./getLoginErrors.mjs";

const shouldCloseAppWhenLogin = async (page, sendWhatsappMessage) => {
  const clientPhoneNumber = process.env.CLIENT_WHATSAPP_NUMBER;

  const errors = await getLoginErrors(page);

  const errorsLength = errors?.length ?? 0;

  if (errorsLength) {
    createConsoleMessage(
      `❌ Login errors: ${errors.join(", ")} sending errors to client...`,
      "warn"
    );

    const isErrorAboutLockedOut =
      errorsLength === 1 && errors[0].includes("locked out");

    const shouldCloseApp = errorsLength > 1 || !isErrorAboutLockedOut;

    await sendWhatsappMessage(clientPhoneNumber, [
      {
        message:
          "⚠️ *‼️ Login Errors Detected ‼️*\n" +
          "────────────────────────\n" +
          errors.map((error, i) => `🔸 ${i + 1}. ${error}`).join("\n") +
          "\n\n" +
          `⚠️ ${
            shouldCloseApp
              ? "*CLOSING APP UNTILL FIXED*"
              : "*RE-TRYING IN 40 MINUTES*"
          }`,
      },
    ]);

    await page.screenshot({
      path: `screenshots/login-error-${Date.now()}.png`,
    });

    return {
      shouldCloseApp,
      isErrorAboutLockedOut,
    };
  }

  return {
    shouldCloseApp: false,
  };
};

export default shouldCloseAppWhenLogin;
