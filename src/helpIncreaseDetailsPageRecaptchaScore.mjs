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

  console.log("playing section 1");
  await playMovementOnSection({
    page,
    section: patientInfoSection,
    cursor,
    // skipClickingSectionCollapsibleButton: Math.random() < 0.45,
    useArrowDownAtEnd: true,
    playItemsSelectionAndMovements: Math.random() < 0.75,
  });

  // console.log("playing section 2")
  await playMovementOnSection({
    page,
    playInitialKeyboardVerticalArrows: true,
    section: patientDetailsSection,
    scrollIntoViewSection: true,
    cursor,
    playItemsSelectionAndMovements: true,
    // skipClickingSectionCollapsibleButton: Math.random() < 0.4,
  });

  const isDashboardLinkedHovered = Math.random() < 0.6;
  if (isDashboardLinkedHovered) {
    console.log("playing dashboard link");
    await cursor.move(dashboardLinkSelector);
    await sleep(200 + Math.random() * 100); // [200 - 300] ms
  }

  console.log("playing section 3");
  await playMovementOnSection({
    page,
    section: uploadSection,
    cursor,
    scrollIntoViewSection: true,
    skipClickingSectionCollapsibleButton: true,
    // onBeforeClickingSection: async () => {
    //   await selectAttachmentDropdownOption(page, actionName);

    //   if (Math.random() < 0.56) {
    //     const browserButton = await page.$(browserButtonSelector);
    //     if (browserButton) {
    //       await cursor.move(browserButton);
    //     } else {
    //       console.warn(
    //         "Browse button not found by selector:",
    //         browserButtonSelector
    //       );
    //     }
    //   }

    //   await sleep(250); // let :hover styles apply
    // },
  });

  const isScrolledDown = Math.random() < 0.72;

  if (isScrolledDown) {
    await proceduresSection.evaluate((el) =>
      el.scrollIntoView({
        block: "center",
        inline: "center",
        behavior: "smooth",
      })
    );

    await sleep(150 + Math.random() * 150); // [150 - 300] ms

    await page.keyboard.press("ArrowDown", {
      delay: 50 + Math.floor(Math.random() * 30),
    });
  }

  await sleep(150 + Math.random() * 150); // [150 - 300] ms

  await cursor.toggleRandomMove(true);
  await sleep(200 + Math.random() * 60); // [200 - 260] ms

  if (!isDashboardLinkedHovered) {
    await cursor.move(dashboardLinkSelector);
    await sleep(200 + Math.random() * 100); // [200 - 300] ms
  }

  const [randomSection] = shuffle(sections);

  await randomSection.evaluate((el) =>
    el.scrollIntoView({
      block: "end",
      behavior: "smooth",
    })
  );

  await sleep(160 + Math.random() * 80); // [160 - 240] ms

  const buttonToClick = await randomSection.$(
    "button.MuiButtonBase-root.MuiIconButton-root.MuiIconButton-sizeMedium"
  );

  await cursor.click(buttonToClick, {
    hesitate: 95 + Math.random() * 60,
    waitForClick: 95 + Math.random() * 50,
  });
};

export default helpIncreaseDetailsPageRecaptchaScore;
