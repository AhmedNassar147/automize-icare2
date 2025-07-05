/*
 *
 * Helpers `spoofBattery`.
 *
 */
import spoofNative from "./spoofNative.mjs";

const spoofBattery = () => {
  const createBatteryMock = () => {
    let isCharging = true;
    let level = 1.0; // يبدأ كامل الشحن
    let chargingTime = randomInt(45 * 60, 90 * 60); // 45 إلى 90 دقيقة (بالثواني)
    let dischargingTime = randomInt(55 * 60, 2.5 * 3600); // 55 دقيقة إلى 2.5 ساعة (بالثواني)

    let updatesStopped = false;
    let dischargeDropsLeft = 0;

    function randomInt(min, max) {
      return Math.floor(min + Math.random() * (max - min));
    }

    function randomLevelDrop() {
      return 0.15 + Math.random() * 0.1; // 15%-25%
    }

    function randomDropsCount() {
      return (
        1 + Math.floor(Math.random() * 4) + (Math.random() < 0.5 ? 0.5 : 0)
      );
    }

    const updateBatteryState = () => {
      if (updatesStopped) return;

      if (level >= 1) {
        // عند الشحن الكامل: احتمالات حسب المطلوب
        if (!isCharging) {
          if (dischargeDropsLeft > 0) {
            const drop = randomLevelDrop();
            level = Math.max(0, level - drop);
            dischargeDropsLeft -= 1;
            dispatchLevelChange();
          } else {
            isCharging = true;
            chargingTime = randomInt(45 * 60, 90 * 60);
            dischargingTime = randomInt(55 * 60, 2.5 * 3600);
            dispatchChargingChange();
          }
        } else {
          // الاحتمالات:
          // 55% يكمل الشحن (يبقى isCharging true)
          // 25% يوقف مؤقتًا مع نزول تدريجي
          // 20% يوقف أو يكمل عشوائي

          const r = Math.random();
          if (r < 0.55) {
            // يكمل الشحن عادي
            // do nothing, يبقى isCharging = true
          } else if (r < 0.8) {
            // يوقف مؤقت + تنزيل تدريجي
            isCharging = false;
            dischargeDropsLeft = randomDropsCount();
            dispatchChargingChange();
          } else {
            // 20%: عشوائي بين الوقف أو الاستمرار
            if (Math.random() < 0.5) {
              isCharging = false;
              dischargeDropsLeft = randomDropsCount();
              dispatchChargingChange();
            } else {
              // يبقى isCharging true
            }
          }
        }
        return;
      }

      // حالة الشحن العادي (غير 100%)
      if (isCharging) {
        if (chargingTime > 0) {
          chargingTime -= randomInt(360, 720); // عشوائي بين 6 إلى 12 دقيقة (بالثواني)
          level = Math.min(1, level + 0.05 + Math.random() * 0.03);
          dispatchLevelChange();
        } else {
          level = 1;
          dispatchLevelChange();
          dispatchChargingChange();
        }
      } else {
        if (dischargingTime > 0) {
          dischargingTime -= randomInt(360, 720);
          level = Math.max(0, level - (0.01 + Math.random() * 0.03));
          dispatchLevelChange();
        } else {
          isCharging = true;
          chargingTime = randomInt(45 * 60, 90 * 60);
          dischargingTime = randomInt(55 * 60, 2.5 * 3600);
          dispatchChargingChange();
        }
      }
    };

    const dispatchChargingChange = () => {
      batteryProxy.dispatchEvent(new Event("chargingchange"));
    };

    const dispatchLevelChange = () => {
      batteryProxy.dispatchEvent(new Event("levelchange"));
    };

    const dispatchChargingTimeChange = () => {
      batteryProxy.dispatchEvent(new Event("chargingtimechange"));
    };

    const dispatchDischargingTimeChange = () => {
      batteryProxy.dispatchEvent(new Event("dischargingtimechange"));
    };

    const batteryTarget = {
      get charging() {
        return isCharging;
      },
      get level() {
        return parseFloat(level.toFixed(3));
      },
      get chargingTime() {
        return isCharging ? chargingTime : 0;
      },
      get dischargingTime() {
        return !isCharging ? dischargingTime : Infinity;
      },
      onchargingchange: null,
      onlevelchange: null,
      onchargingtimechange: null,
      ondischargingtimechange: null,
    };

    // تحديث التوقيت العشوائي كل مرة 6-12 دقيقة
    let timeoutId;
    const scheduleNextUpdate = () => {
      if (updatesStopped) return;
      const nextInterval = randomInt(6 * 60 * 1000, 12 * 60 * 1000);
      timeoutId = setTimeout(() => {
        updateBatteryState();
        scheduleNextUpdate();
      }, nextInterval);
    };

    scheduleNextUpdate();

    const batteryProxy = new Proxy(batteryTarget, {
      get(target, prop, receiver) {
        if (prop.startsWith("on")) {
          return Reflect.get(target, prop, receiver);
        }
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value) {
        if (prop.startsWith("on") && typeof value === "function") {
          Reflect.set(target, prop, value);
        }
        return true;
      },
    });

    ["addEventListener", "removeEventListener", "dispatchEvent"].forEach(
      (fn) => {
        batteryProxy[fn] = spoofNative(function (...args) {
          return EventTarget.prototype[fn].apply(batteryProxy, args);
        }, fn);
      }
    );

    batteryProxy.addEventListener("chargingchange", (e) => {
      if (typeof batteryProxy.onchargingchange === "function") {
        batteryProxy.onchargingchange(e);
      }
    });
    batteryProxy.addEventListener("levelchange", (e) => {
      if (typeof batteryProxy.onlevelchange === "function") {
        batteryProxy.onlevelchange(e);
      }
    });
    batteryProxy.addEventListener("chargingtimechange", (e) => {
      if (typeof batteryProxy.onchargingtimechange === "function") {
        batteryProxy.onchargingtimechange(e);
      }
    });
    batteryProxy.addEventListener("dischargingtimechange", (e) => {
      if (typeof batteryProxy.ondischargingtimechange === "function") {
        batteryProxy.ondischargingtimechange(e);
      }
    });

    // إيقاف التحديثات تلقائياً بين 1 ساعة إلى 2.5 ساعة
    setTimeout(() => {
      updatesStopped = true;
      clearTimeout(timeoutId);
    }, randomInt(3600 * 1000, 2.5 * 3600 * 1000));

    return batteryProxy;
  };

  Object.defineProperty(navigator, "getBattery", {
    value: () => Promise.resolve(createBatteryMock()),
    configurable: true,
    enumerable: false,
  });
};

export default spoofBattery;
