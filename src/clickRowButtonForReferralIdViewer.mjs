/*
 *
 * helper: `clickRowButtonForReferralIdViewer`
 *
 */
import { homePageTableSelector } from "./constants.mjs";

const clickButtonForReferralId = async (page, referralId) => {
  try {
    const [response, clicked] = await Promise.all([
      page
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 30_000 })
        .catch(() => null),
      page.evaluate(
        ({ homePageTableSelector, referralId }) => {
          const rows = document.querySelectorAll(
            `${homePageTableSelector} tbody tr`
          );

          for (const row of rows) {
            const cells = row.querySelectorAll("td");
            if (cells.length < 9) continue;

            const secondCell = cells[1];
            const buttonCell = cells[8];

            const text = secondCell?.querySelector("span")?.textContent?.trim();

            if (text === referralId) {
              const button = buttonCell?.querySelector("button");
              if (button) {
                button.click(); // Trigger navigation
                return true;
              }
            }
          }

          return false;
        },
        { homePageTableSelector, referralId }
      ),
    ]);

    if (clicked) {
      console.log(`✅ View Button Clicked for referralId: ${referralId}`);
      if (!response) {
        console.warn(
          "⚠️ View Button Clicked, but no navigation detected within timeout."
        );
      }
    } else {
      console.warn(`❌ View Button not found for referralId: ${referralId}`);
    }

    return !!clicked;
  } catch (err) {
    console.error(
      `❌ Error during click/navigation for referralId: ${referralId}`,
      err.message
    );
  }

  return false;
};

export default clickButtonForReferralId;
