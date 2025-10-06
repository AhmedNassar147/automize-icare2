/*
 *
 * Helper: `playMovementOnSection`.
 *
 */
import { path } from "ghost-cursor";
import sleep from "./sleep.mjs";
// import shuffle from "./shuffle.mjs";

const rand = (min, max) => min + Math.random() * (max - min);

// const selectByDragGhost = async (
//   page,
//   cursor,
//   handle,
//   { padding = 6, moveSpeed = rand(0.9, 1.6) } = {}
// ) => {
//   // make sure it's laid out
//   await handle.evaluate((el) =>
//     el.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" })
//   );
//   const box = await handle.boundingBox();
//   if (!box) return false;

//   const startX = box.x + padding;
//   const endX = box.x + Math.max(padding, box.width - padding);
//   const y = box.y + box.height / 2;

//   // move to start with ghost cursor
//   await cursor.moveTo(
//     { x: startX, y },
//     { moveSpeed, moveDelay: 100, randomizeMoveDelay: true }
//   );

//   // hold button, then drag using ghost cursor path
//   await page.mouse.down();
//   await cursor.moveTo(
//     { x: endX, y },
//     { moveSpeed, moveDelay: 80, randomizeMoveDelay: true }
//   );
//   await page.mouse.up();
//   return true;
// };

// const selectByClicksGhost = async (page, cursor, handle, triple) => {
//   await handle.evaluate((el) =>
//     el.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" })
//   );
//   const box = await handle.boundingBox();
//   if (!box) return false;

//   const x = box.x + box.width / 2 + rand(-3, 3);
//   const y = box.y + box.height / 2 + rand(-2, 2);

//   // glide in with ghost-cursor, then use native click so we can set clickCount
//   await cursor.moveTo(
//     { x, y },
//     { moveSpeed: rand(0.9, 1.5), moveDelay: 120, randomizeMoveDelay: true }
//   );
//   await sleep(rand(40, 100));
//   await page.mouse.click(x, y, { clickCount: triple ? 3 : 2, delay: 60 });
//   return true;
// };

const getSectionCollapsibleButton = async (section) =>
  await section?.$?.(
    "button.MuiButtonBase-root.MuiIconButton-root.MuiIconButton-sizeMedium"
  );

const playMovementOnSection = async ({
  page,
  section,
  cursor,
  onBeforeClickingSection,
  playInitialKeyboardVerticalArrows,
  skipClickingSectionCollapsibleButton,
  useArrowDownAtEnd,
  playItemsSelectionAndMovements,
}) => {
  // if (playInitialKeyboardVerticalArrows) {
  // await page.keyboard.press(Math.random() < 0.65 ? "ArrowUp" : "ArrowDown", {
  //   delay: 50 + Math.floor(Math.random() * 30),
  // });
  // }

  await sleep(120 + Math.random() * 50); // [100 - 150] ms

  if (!section) {
    return;
  }

  await section.evaluate((el) =>
    el.scrollIntoView({
      block: Math.random() < 0.65 ? "end" : "center",
      behavior: "smooth",
    })
  );

  await sleep(180 + Math.random() * 60); // [170 - 230] ms
  const sectionBox = await section.boundingBox();

  const cx = sectionBox.x + sectionBox.width * 0.5 + rand(-8, 8);
  const cy = sectionBox.y + sectionBox.height * 0.5 + rand(-8, 8);

  const movementRoutes = path(cursor.getLocation(), {
    x: cx + 90 + Math.random() * 110,
    y: cy + 80 + Math.random() * 100,
  });

  await cursor.moveTo(movementRoutes, {
    moveSpeed: 1 + Math.random() * 0.5,
    moveDelay: 90 + Math.floor(Math.random() * 140),
    randomizeMoveDelay: true,
  });

  // let titleElement;

  if (Math.random() < 0.6) {
    console.time("move title");
    // titleElement = await section.$("h2.section-title");
    await cursor.toggleRandomMove(true);
    console.timeEnd("move title");
  }

  // const sectionCollapsibleButton = titleElement
  //   ? titleElement
  //   : await getSectionCollapsibleButton(section);

  // //   if (!skipClickingSectionCollapsibleButton) {
  // //   console.time("CLICK")

  // //     await cursor.click(sectionCollapsibleButton, {
  // //     hesitate: 80 + Math.random() * 60,
  // //     waitForClick: 90 + Math.random() * 50,
  // //   });
  // //   console.timeEnd("CLICK")
  // // }

  if (Math.random() < 0.6) {
    await page.keyboard.press(Math.random() < 0.65 ? "ArrowUp" : "ArrowDown", {
      delay: 50 + Math.floor(Math.random() * 30),
    });
  }

  if (onBeforeClickingSection) {
    await sleep(180 + Math.random() * 100); // [170 - 270] ms
    await onBeforeClickingSection();
  } else {
    await sleep(170 + Math.random() * 110); // [130 - 110] ms
  }

  if (Math.random() < 0.65) {
    await cursor.toggleRandomMove(true);

    console.time("CLICK2");
    await cursor.click(section, {
      hesitate: 100 + Math.random() * 70,
      waitForClick: 100 + Math.random() * 60,
    });
    console.timeEnd("CLICK2");
  }

  await sleep(150 + Math.random() * 150); // [150 - 300] ms
};

export default playMovementOnSection;

// console.log("playItemsSelectionAndMovements", playItemsSelectionAndMovements)

// if (playItemsSelectionAndMovements) {
//   try {
//     const gridItems = await section.$$("div.grid-item");
//     if (gridItems?.length) {
//       // randomize order so we visit each once in a random sequence
//       const visitOrder = shuffle([...gridItems])
//         .slice(
//           0,
//           Math.min(gridItems.length, 4 + Math.floor(Math.random() * 3))
//         )
//         .filter(Boolean);

//       if (visitOrder.length) {
//         for (const item of visitOrder) {
//           // ensure visible on screen
//           try {
//             await item.evaluate((el) =>
//               el.scrollIntoView({
//                 behavior: "auto",
//                 block: "center",
//                 inline: "nearest",
//               })
//             );
//           } catch {}

//           await cursor.move(item, {
//             moveSpeed: 0.9 + Math.random() * 0.8,
//             moveDelay: 90 + Math.floor(Math.random() * 180),
//             randomizeMoveDelay: true,
//           });

//           // 4) sometimes visually select the item-description text
//           const descElement = await item.$(".item-description");
//           if (descElement && Math.random() < 0.5) {
//             // choose a selection style randomly
//             if (Math.random() < 0.6) {
//               // mouse drag selection (most human-like)
//               await selectByDragGhost(page, cursor, descElement);
//             } else {
//               // quick triple-click to select the whole line (browser-dependent)
//               await selectByClicksGhost(
//                 page,
//                 cursor,
//                 descElement,
//                 Math.random() < 0.65
//               );
//             }

//             await sleep(rand(120, 260));
//           }
//         }
//       }

//       await sleep(rand(80, 200));
//     }
//   } catch (error) {}
// }
