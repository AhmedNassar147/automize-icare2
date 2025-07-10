/*
 *
 * Helper: `shouldCloseAppWhenLogin`.
 *
 */
import getLoginErrors from "./getLoginErrors.mjs";
import sleep from "./sleep.mjs";

const shouldCloseAppWhenLogin = async (page, sendWhatsappMessage) => {
  const clientPhoneNumber = process.env.CLIENT_WHATSAPP_NUMBER;

  const errors = await getLoginErrors(page);

  if (errors?.length) {
    console.error(
      `❌ Login errors: ${errors.join(", ")} sending errors to client...`
    );

    await sendWhatsappMessage(clientPhoneNumber, [
      {
        message:
          "⚠️ *‼️ Login Errors Detected ‼️*\n" +
          "────────────────────────\n" +
          errors.map((error, i) => `🔸 ${i + 1}. ${error}`).join("\n") +
          "\n\n" +
          "────────────────────────\n" +
          "⚠️ * CLOSING APP UNTILL FIXED *",
      },
    ]);

    await page.screenshot({
      path: `screenshots/login-error-${Date.now()}.png`,
    });

    await sleep(12_000);

    return true;
  }

  return false;
};

export default shouldCloseAppWhenLogin;
