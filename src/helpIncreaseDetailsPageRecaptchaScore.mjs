/*
 *
 * Helper: `helpIncreaseDetailsPageRecaptchaScore`.
 *
 */
import { path } from "ghost-cursor";
import sleep from "./sleep.mjs";
import playMovementOnSection from "./playMovementOnSection.mjs";
import selectAttachmentDropdownOption from "./selectAttachmentDropdownOption.mjs";
import { dashboardLinkSelector } from "./constants.mjs";
import shuffle from "./shuffle.mjs";

const browserButtonSelector =
  "button.MuiTypography-root.MuiTypography-body2.MuiLink-root.MuiLink-underlineAlways.MuiLink-button";

const helpIncreaseDetailsPageRecaptchaScore = async ({
  page,
  cursor,
  actionName,
  isUploadFormOn,
}) => {
  await sleep(600 + Math.random() * 150); // [600 - 750] ms

  // if (Math.random() < 0.65) {
  //   await page.keyboard.press(Math.random() < 0.65 ? "ArrowUp" : "ArrowDown");

  //   await sleep(130 + Math.random() * 60); // [130 - 190] ms
  // }

  const currentCursorLocation = cursor.getLocation();

  const initialMovementRoutes = path(currentCursorLocation, {
    x: currentCursorLocation.x + 95 + Math.random() * 180,
    y: currentCursorLocation.y + 90 + Math.random() * 250,
  });

  await cursor.moveTo(initialMovementRoutes, {
    moveSpeed: 0.9 + Math.random() * 0.6,
    randomizeMoveDelay: true,
  });

  await sleep(180 + Math.random() * 80); // [180 - 260] ms
  const sections = await page.$$("section.collapsible-container");

  const [
    patientInfoSection,
    patientDetailsSection,
    uploadSection,
    proceduresSection,
  ] = sections.filter(Boolean);

  await playMovementOnSection({
    page,
    cursor,
    section: patientInfoSection,
  });

  await playMovementOnSection({
    page,
    cursor,
    section: patientDetailsSection,
  });

  const isDashboardLinkedHovered = Math.random() < 0.6;
  if (isDashboardLinkedHovered) {
    await cursor.move(dashboardLinkSelector, {
      moveSpeed: 1 + Math.random() * 0.5,
      moveDelay: 90 + Math.floor(Math.random() * 140),
      randomizeMoveDelay: true,
    });
    await sleep(200 + Math.random() * 100); // [200 - 300] ms
  }

  console.log("playing section 3");
  await playMovementOnSection({
    page,
    section: uploadSection,
    cursor,
    playInitialKeyboardVerticalArrows: Math.random() > 0.6,
    onBeforeClickingSection: async () => {
      if (isUploadFormOn) {
        await selectAttachmentDropdownOption(page, actionName);

        if (Math.random() < 0.56) {
          const browserButton = await page.$(browserButtonSelector);
          if (browserButton) {
            await cursor.move(browserButton);
          } else {
            console.warn(
              "Browse button not found by selector:",
              browserButtonSelector
            );
          }
        }

        await sleep(200); // let :hover styles apply
      }
    },
  });

  if (Math.random() < 0.72 && proceduresSection) {
    await proceduresSection.evaluate((el) =>
      el.scrollIntoView({
        block: Math.random() < 0.65 ? "end" : "center",
        behavior: "smooth",
      })
    );

    await sleep(180 + Math.random() * 150); // [180 - 300] ms
  }

  if (Math.random() < 0.6) {
    await page.keyboard.press("ArrowDown");
    await sleep(50 + Math.random() * 100);
  }

  await sleep(180 + Math.random() * 150); // [150 - 300] ms

  await cursor.toggleRandomMove(true);
  await sleep(200 + Math.random() * 60); // [200 - 260] ms

  if (!isDashboardLinkedHovered && Math.random() > 0.8) {
    await cursor.move(dashboardLinkSelector, {
      moveSpeed: 1 + Math.random() * 0.5,
      moveDelay: 90 + Math.floor(Math.random() * 140),
      randomizeMoveDelay: true,
    });
    await sleep(200 + Math.random() * 100); // [200 - 300] ms
  }

  const [randomSection] = shuffle(sections).filter(Boolean);
  const _randomSection =
    randomSection ||
    patientInfoSection ||
    patientDetailsSection ||
    uploadSection;

  await _randomSection.evaluate((el) =>
    el.scrollIntoView({
      block: "center",
      behavior: "smooth",
    })
  );

  await sleep(250 + Math.random() * 100); // [250 - 350] ms

  const buttonToClick = await _randomSection.$(
    "button.MuiButtonBase-root.MuiIconButton-root.MuiIconButton-sizeMedium"
  );

  return buttonToClick;
};

export default helpIncreaseDetailsPageRecaptchaScore;
