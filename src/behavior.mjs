const getBehaviorData = async () => {
  const behavioral = {
    mouseEvents: [],
    touchEvents: [],
    motionEvents: [],
    typingEvents: [],
    timeToFirstInteraction: null,
    interactionTimestamps: [],
  };

  let firstInteractionRecorded = false;
  let mouseStartTimestamp = null;

  // Record mouse movements and clicks
  document.addEventListener("mousemove", (e) => {
    if (!mouseStartTimestamp) mouseStartTimestamp = performance.now();
    behavioral.mouseEvents.push({
      x: e.clientX,
      y: e.clientY,
      t: performance.now() - mouseStartTimestamp,
    });
  });

  document.addEventListener("click", (e) => {
    behavioral.mouseEvents.push({
      type: "click",
      x: e.clientX,
      y: e.clientY,
      t: performance.now() - mouseStartTimestamp,
    });
    recordFirstInteraction();
  });

  // Record touch events
  window.addEventListener("touchstart", (e) => {
    [...e.touches].forEach((t) => {
      behavioral.touchEvents.push({
        type: "touchstart",
        identifier: t.identifier,
        x: t.clientX,
        y: t.clientY,
        t: performance.now(),
      });
    });
    recordFirstInteraction();
  });

  window.addEventListener("touchend", (e) => {
    [...e.changedTouches].forEach((t) => {
      behavioral.touchEvents.push({
        type: "touchend",
        identifier: t.identifier,
        x: t.clientX,
        y: t.clientY,
        t: performance.now(),
      });
    });
  });

  // Record device motion
  if (
    typeof DeviceMotionEvent !== "undefined" &&
    DeviceMotionEvent.requestPermission
  ) {
    try {
      const permissionState = await DeviceMotionEvent.requestPermission();
      if (permissionState === "granted") {
        window.addEventListener("devicemotion", (e) => {
          behavioral.motionEvents.push({
            acceleration: {
              x: e.acceleration?.x,
              y: e.acceleration?.y,
              z: e.acceleration?.z,
            },
            rotationRate: {
              alpha: e.rotationRate?.alpha,
              beta: e.rotationRate?.beta,
              gamma: e.rotationRate?.gamma,
            },
            interval: e.interval,
            t: performance.now(),
          });
        });
      }
    } catch (err) {
      console.warn("DeviceMotion permission error:", err);
    }
  } else {
    window.addEventListener("devicemotion", (e) => {
      behavioral.motionEvents.push({
        acceleration: {
          x: e.acceleration?.x,
          y: e.acceleration?.y,
          z: e.acceleration?.z,
        },
        rotationRate: {
          alpha: e.rotationRate?.alpha,
          beta: e.rotationRate?.beta,
          gamma: e.rotationRate?.gamma,
        },
        interval: e.interval,
        t: performance.now(),
      });
    });
  }

  // Record keystrokes
  document.addEventListener("keydown", (e) => {
    behavioral.typingEvents.push({
      key: e.key,
      code: e.code,
      tDown: performance.now(),
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
    });
    recordFirstInteraction();
  });

  document.addEventListener("keyup", (e) => {
    const last = behavioral.typingEvents.findLast((ev) => ev.code === e.code);
    if (last) {
      last.tUp = performance.now();
      last.duration = last.tUp - last.tDown;
    }
  });

  // Time to first interaction
  const recordFirstInteraction = () => {
    if (!firstInteractionRecorded) {
      behavioral.timeToFirstInteraction = performance.now();
      firstInteractionRecorded = true;
    }
  };

  ["click", "mousemove", "keydown", "touchstart"].forEach((event) => {
    document.addEventListener(
      event,
      () => {
        if (!firstInteractionRecorded) {
          behavioral.timeToFirstInteraction = performance.now();
          firstInteractionRecorded = true;
        }
      },
      { once: true }
    );
  });

  await document.fonts.ready;

  return behavioral;
};
