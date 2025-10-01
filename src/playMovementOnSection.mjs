/*
 *
 * Helper: `playMovementOnSection`.
 *
 */
import { path } from "ghost-cursor";
import sleep from "./sleep.mjs";
import shuffle from "./shuffle.mjs";

const rand = (min, max) => min + Math.random() * (max - min);

const selectByDragGhost = async (
  page,
  cursor,
  handle,
  { padding = 6, moveSpeed = rand(0.9, 1.6) } = {}
) => {
  // make sure it's laid out
  await handle.evaluate((el) =>
    el.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" })
  );
  const box = await handle.boundingBox();
  if (!box) return false;

  const startX = box.x + padding;
  const endX = box.x + Math.max(padding, box.width - padding);
  const y = box.y + box.height / 2;

  // move to start with ghost cursor
  await cursor.moveTo(
    { x: startX, y },
    { moveSpeed, moveDelay: 100, randomizeMoveDelay: true }
  );

  // hold button, then drag using ghost cursor path
  await page.mouse.down();
  await cursor.moveTo(
    { x: endX, y },
    { moveSpeed, moveDelay: 80, randomizeMoveDelay: true }
  );
  await page.mouse.up();
  return true;
};

const selectByClicksGhost = async (page, cursor, handle, triple) => {
  await handle.evaluate((el) =>
    el.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" })
  );
  const box = await handle.boundingBox();
  if (!box) return false;

  const x = box.x + box.width / 2 + rand(-3, 3);
  const y = box.y + box.height / 2 + rand(-2, 2);

  // glide in with ghost-cursor, then use native click so we can set clickCount
  await cursor.moveTo(
    { x, y },
    { moveSpeed: rand(0.9, 1.5), moveDelay: 120, randomizeMoveDelay: true }
  );
  await sleep(rand(40, 100));
  await page.mouse.click(x, y, { clickCount: triple ? 3 : 2, delay: 60 });
  return true;
};

const getSectionCollapsibleButton = async (section) =>
  await section?.$?.(
    "button.MuiButtonBase-root.MuiIconButton-root.MuiIconButton-sizeMedium"
  );

const playMovementOnSection = async ({
  page,
  section,
  cursor,
  scrollIntoViewSection,
  playInitialKeyboardVerticalArrows,
  onBeforeClickingSection,
  skipClickingSectionCollapsibleButton,
  useArrowDownAtEnd,
  playItemsSelectionAndMovements,
}) => {
  if (playInitialKeyboardVerticalArrows) {
    await page.keyboard.press(Math.random() < 0.65 ? "ArrowUp" : "ArrowDown", {
      delay: 50 + Math.floor(Math.random() * 30),
    });

    await sleep(100 + Math.random() * 50); // [100 - 150] ms

    await page.keyboard.press(Math.random() < 0.65 ? "ArrowUp" : "ArrowDown", {
      delay: 50 + Math.floor(Math.random() * 30),
    });

    await sleep(60 + Math.random() * 40); // [60 - 100] ms
  }

  if (scrollIntoViewSection) {
    await cursor.scrollIntoView(section, {
      scrollSpeed: 88 + Math.random() * 12,
      scrollDelay: 80 + Math.random() * 120,
      inViewportMargin: 20,
    });
  }

  let sectionBox = await section.boundingBox();

  if (!sectionBox) {
    // element is not visible/attached; try to scroll into view and re-measure
    await section.evaluate((el) =>
      el.scrollIntoView({
        block: "center",
        inline: "center",
        behavior: "smooth",
      })
    );

    await sleep(120 + Math.random() * 40); // [120 - 160] ms

    sectionBox = await section.boundingBox();
  }

  const cx = sectionBox.x + sectionBox.width * 0.5 + rand(-8, 8);
  const cy = sectionBox.y + sectionBox.height * 0.5 + rand(-8, 8);

  const movementRoutes = path(cursor.getLocation(), {
    x: cx + 90 + Math.random() * 110,
    y: cy + 80 + Math.random() * 100,
  });

  await cursor.moveTo(movementRoutes, {
    moveSpeed: 0.87 + Math.random() * 0.9,
    randomizeMoveDelay: true,
  });

  await sleep(90 + Math.random() * 40); // [110 - 150] ms

  let titleElement;

  if (Math.random() < 0.6) {
    titleElement = await section.$("h2.section-title");

    await titleElement.evaluate((el) =>
      el.scrollIntoView({
        behavior: "auto",
        block: "center",
        inline: "nearest",
      })
    );

    await cursor.move(titleElement, {
      moveSpeed: 0.85 + Math.random() * 0.9,
      moveDelay: 200 + Math.floor(Math.random() * 200), // optional pause after move
      randomizeMoveDelay: true,
    });
  }

  if (playItemsSelectionAndMovements) {
    try {
      const gridItems = await section.$$("div.grid-item");
      if (gridItems?.length) {
        // randomize order so we visit each once in a random sequence
        const visitOrder = shuffle([...gridItems])
          .slice(
            0,
            Math.min(gridItems.length, 4 + Math.floor(Math.random() * 3))
          )
          .filter(Boolean);

        if (visitOrder.length) {
          for (const item of visitOrder) {
            // ensure visible on screen
            try {
              await item.evaluate((el) =>
                el.scrollIntoView({
                  behavior: "auto",
                  block: "center",
                  inline: "nearest",
                })
              );
            } catch {}

            await cursor.move(item, {
              moveSpeed: 0.9 + Math.random() * 0.8,
              moveDelay: 120 + Math.floor(Math.random() * 180),
              randomizeMoveDelay: true,
            });

            await sleep(rand(60, 180));

            // 4) sometimes visually select the item-description text
            const descElement = await item.$(".item-description");
            if (descElement && Math.random() < 0.5) {
              // choose a selection style randomly
              if (Math.random() < 0.6) {
                // mouse drag selection (most human-like)
                await selectByDragGhost(page, cursor, descElement);
              } else {
                // quick triple-click to select the whole line (browser-dependent)
                await selectByClicksGhost(
                  page,
                  cursor,
                  descElement,
                  Math.random() < 0.65
                );
              }

              await sleep(rand(120, 260));
            }
          }
        }

        await sleep(rand(80, 200));
      }
    } catch (error) {}
  }

  const sectionCollapsibleButton = titleElement
    ? titleElement
    : await getSectionCollapsibleButton(section);

  if (titleElement) {
    await cursor.move(sectionCollapsibleButton, {
      moveSpeed: 0.9 + Math.random() * 0.6,
      randomizeMoveDelay: true,
    });
  }

  await sleep(rand(60, 100));

  if (!skipClickingSectionCollapsibleButton) {
    await cursor.click(sectionCollapsibleButton, {
      hesitate: 110 + Math.random() * 70,
      waitForClick: 110 + Math.random() * 60,
      moveSpeed: 0.89 + Math.random() * 0.7,
      randomizeMoveDelay: true,
      overshootThreshold: 500,
    });
  }

  await sleep(110 + Math.random() * 50); // [110 - 160] ms

  if (onBeforeClickingSection) {
    await sleep(170 + Math.random() * 100); // [170 - 270] ms
    await onBeforeClickingSection();
  }

  if (Math.random() < 0.7) {
    await sleep(100 + Math.random() * 90); // [100 - 190] ms

    await cursor.click(section, {
      hesitate: 110 + Math.random() * 60,
      waitForClick: 110 + Math.random() * 50,
    });
  }

  await sleep(130 + Math.random() * 90); // [130 - 210] ms

  if (useArrowDownAtEnd) {
    await page.keyboard.press("ArrowDown", {
      delay: 50 + Math.floor(Math.random() * 30),
    });

    await sleep(50 + Math.random() * 70); // [50 - 120] ms

    await page.keyboard.press("ArrowDown", {
      delay: 50 + Math.floor(Math.random() * 30),
    });
  }

  await sleep(180 + Math.random() * 150); // [170 - 320] ms
};

export default playMovementOnSection;
