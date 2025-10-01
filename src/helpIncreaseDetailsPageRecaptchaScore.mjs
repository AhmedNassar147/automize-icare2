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

const browserButtonSelector =
  "button.MuiTypography-root.MuiTypography-body2.MuiLink-root.MuiLink-underlineAlways.MuiLink-button";

const helpIncreaseDetailsPageRecaptchaScore = async ({
  page,
  cursor,
  actionName,
}) => {
  await sleep(90 + Math.random() * 70); // [90 - 160] ms

  if (Math.random() < 0.65) {
    await page.keyboard.press(Math.random() < 0.65 ? "ArrowUp" : "ArrowDown", {
      delay: 50 + Math.floor(Math.random() * 30),
    });

    await sleep(110 + Math.random() * 40); // [110 - 150] ms
  }

  const currentCursorLocation = cursor.getLocation();

  const initialMovementRoutes = path(currentCursorLocation, {
    x: currentCursorLocation.x + 95 + Math.random() * 180,
    y: currentCursorLocation.y + 90 + Math.random() * 250,
  });

  await cursor.moveTo(initialMovementRoutes, {
    moveSpeed: 0.9 + Math.random() * 0.6,
    randomizeMoveDelay: true,
  });

  await sleep(110 + Math.random() * 80); // [110 - 190] ms
  const sections = await page.$$("section.collapsible-container.MuiBox-root");

  const [
    patientInfoSection,
    patientDetailsSection,
    uploadSection,
    proceduresSection,
  ] = sections.filter(Boolean);

  await playMovementOnSection({
    page,
    section: patientInfoSection,
    cursor,
    skipClickingSectionCollapsibleButton: Math.random() < 0.45,
    useArrowDownAtEnd: true,
    playItemsSelectionAndMovements: Math.random() < 0.75,
  });

  await playMovementOnSection({
    page,
    playInitialKeyboardVerticalArrows: true,
    section: patientDetailsSection,
    scrollIntoViewSection: true,
    cursor,
    playItemsSelectionAndMovements: true,
    skipClickingSectionCollapsibleButton: Math.random() < 0.4,
  });

  if (Math.random() < 0.6) {
    await cursor.move(dashboardLinkSelector);
    await sleep(50 + Math.random() * 100); // [50 - 150] ms
  }

  await playMovementOnSection({
    page,
    section: uploadSection,
    cursor,
    scrollIntoViewSection: true,
    skipClickingSectionCollapsibleButton: true,
    onBeforeClickingSection: async () => {
      await selectAttachmentDropdownOption(page, actionName);

      if (Math.random() < 0.56) {
        const browserButton = await page.$(browserButtonSelector);
        if (browserButton) {
          await browserButton.evaluate((el) =>
            el.scrollIntoView({
              block: "center",
              inline: "center",
            })
          );
          await cursor.move(browserButton, {
            moveSpeed: 0.9 + Math.random() * 0.5,
            randomizeMoveDelay: true,
          });
        } else {
          console.warn(
            "Browse button not found by selector:",
            browserButtonSelector
          );
        }
      }

      await sleep(250); // let :hover styles apply
    },
  });

  if (Math.random() < 0.72) {
    await cursor.scrollIntoView(proceduresSection, {
      scrollSpeed: 85 + Math.random() * 12,
      scrollDelay: 80 + Math.random() * 150,
      inViewportMargin: 20,
    });

    await sleep(150 + Math.random() * 60); // [150 - 260] ms
  }

  if (Math.random() < 0.68) {
    await cursor.toggleRandomMove(true);
  } else {
    await page.keyboard.press(Math.random() < 0.5 ? "ArrowUp" : "ArrowDown", {
      delay: 50 + Math.floor(Math.random() * 30),
    });

    await sleep(120 + Math.random() * 40); // [120 - 160] ms

    await page.keyboard.press(Math.random() < 0.65 ? "ArrowUp" : "ArrowDown", {
      delay: 50 + Math.floor(Math.random() * 30),
    });
  }

  await sleep(200 + Math.random() * 60); // [200 - 260] ms

  if (Math.random() < 0.75) {
    await cursor.move(dashboardLinkSelector);
    await sleep(70 + Math.random() * 70); // [70 - 140] ms
  }

  const currentShownSectionPlacement = Math.random() < 0.4 ? "bottom" : "top";

  await cursor.scrollIntoView(currentShownSectionPlacement, {
    scrollSpeed: 88 + Math.random() * 12,
    scrollDelay: 80 + Math.random() * 150,
    inViewportMargin: 20,
  });

  await sleep(250 + Math.random() * 60); // [250 - 310] ms

  const currentShownSection =
    currentShownSectionPlacement === "top"
      ? patientInfoSection
      : sections[sections.length - 1];

  const buttonToClick = await currentShownSection.$(
    "button.MuiButtonBase-root.MuiIconButton-root.MuiIconButton-sizeMedium"
  );

  await cursor.click(buttonToClick, {
    hesitate: 110 + Math.random() * 60,
    waitForClick: 110 + Math.random() * 50,
  });

  return currentShownSectionPlacement;
};

export default helpIncreaseDetailsPageRecaptchaScore;
