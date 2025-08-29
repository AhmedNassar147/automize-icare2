// navigate("/target/path", { state: { idReferral: 351733, type: "Referral" } });

// =>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// Simulate navigation with state in a plain JS environment

// window.history.pushState(
//   {
//     usr: { idReferral: 351733, type: "Referral" },
//     key: "manual",
//     idx: window.history.state?.idx + 1 || 1,
//   },
//   "",
//   "/target/path"
// );
// window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
