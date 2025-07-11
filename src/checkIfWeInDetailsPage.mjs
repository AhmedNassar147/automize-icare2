/*
 *
 * Helper: `checkIfWeInDetailsPage`.
 *
 */
const checkIfWeInDetailsPage = async (page, isCollectAction) => {
  let areWeInDetailsPage = false;

  const label = `🕒 areWeInDetailsPage${isCollectAction ? "_collect" : ""}`;

  console.time(label);

  try {
    await page.waitForSelector(".statusContainer", {
      timeout: 8000,
      visible: true,
    });
    areWeInDetailsPage = true;
  } catch (err) {
    areWeInDetailsPage = false;
  }

  console.timeEnd(label);
  await page.screenshot({
    path: `screenshots/areWeInDetailsPage-${Date.now()}.png`,
  });

  console.log(`Are we in home page ?:${areWeInDetailsPage}`);

  return areWeInDetailsPage;
};

export default checkIfWeInDetailsPage;
