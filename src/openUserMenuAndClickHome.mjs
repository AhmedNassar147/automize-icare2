/*
 *
 * helper: `openUserMenuAndClickHome`.
 *
 */
import humanClick from "./humanClick.mjs";

// this is the user menu on navbar

{
  /* <div class="MuiBox-root css-1pq18ix">
   <div class="MuiBox-root css-1jfpitw">
      <span class=" MuiBox-root css-koep9a"><strong>H509821-7597</strong></span>
      <div class="MuiAvatar-root MuiAvatar-circular MuiAvatar-colorDefault css-10gllw6">
         <svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium MuiAvatar-fallback css-13y7ul3" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="PersonIcon">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path>
         </svg>
      </div>
   </div>
</div> */
}

// when click it the next menu will appear
{
  /* <div role="presentation" class="MuiPopover-root MuiMenu-root MuiModal-root css-1sucic7">
   <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop css-esi9ax" style="opacity: 1; transition: opacity 225ms cubic-bezier(0.4, 0, 0.2, 1);"></div>
   <div tabindex="0" data-testid="sentinelStart"></div>
   <div class="MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation8 MuiPopover-paper MuiMenu-paper MuiMenu-paper css-4v31z5" tabindex="-1" style="opacity: 1; transform: none; transition: opacity 232ms cubic-bezier(0.4, 0, 0.2, 1), transform 155ms cubic-bezier(0.4, 0, 0.2, 1); top: 56px; left: 1335px; transform-origin: 22.7875px 0px;">
      <ul class="MuiList-root MuiList-padding MuiMenu-list css-r8u8y9" role="menu" tabindex="-1">
         <div tabindex="0">
            <li class="MuiButtonBase-root MuiMenuItem-root MuiMenuItem-gutters MuiMenuItem-root MuiMenuItem-gutters css-n7igab" tabindex="-1" role="menuitem">
              <a href="/">
                <span class="material-icons notranslate MuiIcon-root MuiIcon-fontSizeMedium css-1jgtvd5" aria-hidden="true"> home </span>
                <span class=" MuiBox-root css-koep9a"> Home </span>
              </a>
              <span class="MuiTouchRipple-root css-w0pj6f"></span>
            </li>
         </div>
         <div>
            <li class="MuiButtonBase-root MuiMenuItem-root MuiMenuItem-gutters MuiMenuItem-root MuiMenuItem-gutters css-n7igab" tabindex="-1" role="menuitem"><span class="material-icons notranslate MuiIcon-root MuiIcon-fontSizeMedium css-1jgtvd5" aria-hidden="true"> power_settings_new </span><span class=" MuiBox-root css-koep9a"> Logout </span><span class="MuiTouchRipple-root css-w0pj6f"></span></li>
         </div>
      </ul>
   </div>
   <div tabindex="0" data-testid="sentinelEnd"></div>
</div> */
}

const openUserMenuAndClickHome = async (page, cursor) => {
  // await randomMouseJitter(cursor, 2);

  await humanClick(page, ".MuiAvatar-root.MuiAvatar-circular");

  // Wait for menu to appear
  await page.waitForSelector(".MuiPopover-root", {
    visible: true,
    timeout: 20000,
  });

  // Try to click Home
  const homeClicked = await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll('div[role="presentation"] ul[role="menu"] li')
    );

    const homeItem = items.find((li) => {
      const spans = Array.from(li.querySelectorAll("span"));
      return spans.some((span) => {
        const content = span.textContent || "";
        return content.trim() === "Home";
      });
    });

    if (homeItem) {
      const link = homeItem.querySelector("a");
      if (link) {
        cursor.click(link, {
          moveDelay: 10,
          hesitate: 55,
          radius: 4,
        });
        return true;
      }
    }
    return false;
  });

  // Wait for page navigation if Home was clicked
  if (homeClicked) {
    try {
      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 10000,
      });
      // await randomMouseJitter(cursor, 4);
    } catch (err) {
      console.log("⚠️ Navigation after clicking Home took too long.");
    }
  } else {
    const currentUrl = page.url();
    const baseUrl = new URL(currentUrl).origin;

    console.log(
      "⚠️ Home link not found in user menu, navigating to /Dashboard/Referral."
    );
    await page.goto(`${baseUrl}/Dashboard/Referral`, {
      waitUntil: "networkidle2",
    });
  }
};

export default openUserMenuAndClickHome;
