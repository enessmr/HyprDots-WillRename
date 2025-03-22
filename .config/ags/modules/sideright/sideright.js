import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
const { execAsync, exec } = Utils;
const { Overlay, Box, EventBox, Label } = Widget;
import { RoundedCorner } from "../.commonwidgets/cairo_roundedcorner.js";
import {
  ToggleIconBluetooth,
  ToggleIconWifi,
  ModuleNightLight,
  ModuleIdleInhibitor,
  ToggleIconCalendar,
  ModuleSettingsIcon,
  ModulePowerIcon,
  ModuleGameMode,
  ModuleCloudflareWarp,
} from "./modules/quicktoggles.js";
import ModuleNotificationList from "./centermodules/notificationlist.js";
import ModuleAudioControls from "./centermodules/audiocontrols.js";
import ModuleWifiNetworks from "./centermodules/wifinetworks.js";
import ModulePowerProfiles from "./centermodules/powerprofiles.js";
import ModuleBluetooth from "./centermodules/bluetooth.js";
import { ModuleCalendar } from "./modules/calendar.js";
import ModulePrayerTimes from "./centermodules/prayertimes.js";
import { getDistroIcon } from "../.miscutils/system.js";
import { ExpandingIconTabContainer } from "../.commonwidgets/tabcontainer.js";
import { checkKeybind } from "../.widgetutils/keybind.js";
import GLib from "gi://GLib";
import VPN from "./centermodules/vpn.js";
import taskmanager from "./centermodules/taskmanager.js";
import Gio from "gi://Gio";
const config = userOptions.asyncGet();
const elevate = userOptions.asyncGet().etc.widgetCorners
  ? "sidebar-right"
  : "sidebar-right shadow-window elevation";
export const calendarRevealer = Widget.Revealer({
  revealChild: userOptions.asyncGet().sidebar.ModuleCalendar.visible
    ? true
    : false,
  child: ModuleCalendar(),
  transition: "slide_up",
});
const modulesList = {
  vpnGate: {
    name: "VPN Gate",
    materialIcon: "vpn_key",
    contentWidget: VPN, // Renamed vpn to VPN
  },
  notifications: {
    name: getString("Notifications"),
    materialIcon: "notifications",
    contentWidget: ModuleNotificationList,
  },
  audioControls: {
    name: getString("Audio controls"),
    materialIcon: "volume_up",
    contentWidget: ModuleAudioControls,
  },
  powerProfiles: {
    name: "Power Profiles",
    materialIcon: "speed",
    contentWidget: ModulePowerProfiles,
  },
  taskManager: {
    name: getString("Tasks Manager"),
    materialIcon: "check",
    contentWidget: taskmanager,
  },
  bluetooth: {
    name: getString("Bluetooth"),
    materialIcon: "bluetooth",
    contentWidget: ModuleBluetooth,
  },
  wifiNetworks: {
    name: getString("Wifi networks"),
    materialIcon: "wifi",
    contentWidget: ModuleWifiNetworks,
    onFocus: () => execAsync("nmcli dev wifi list").catch(print),
  },
  prayerTimes: {
    name: "Prayer Times",
    materialIcon: "mosque",
    contentWidget: ModulePrayerTimes,
  },
};

// Get enabled modules from config
const getEnabledModules = () => {
  const enabledModules = config.sidebar.centerModules.enabled || [];
  return enabledModules
    .filter((moduleId) => {
      const moduleConfig = config.sidebar.centerModules[moduleId];
      return moduleConfig && moduleConfig.enabled;
    })
    .map((moduleId) => modulesList[moduleId])
    .filter((module) => module !== undefined);
};

const timeRow = Box({
  className: "spacing-h-10 sidebar-group-invisible-morehorizpad",
  children: [
    Widget.Icon({
      icon: getDistroIcon(),
      className: "txt sec-txt txt-hugerass",
    }),
    Box({
      vertical: true,
      children: [
        Widget.Label({
          xalign: 0,
          className: "txt-small sec-txt txt",
          label: GLib.get_user_name(),
        }),
        Widget.Label({
          xalign: 0,
          opacity: 0.6,
          className: "txt-smallie sec-txt txt",
          setup: (self) => {
            const getUptime = async () => {
              try {
                await execAsync(["bash", "-c", "uptime -p"]);
                return execAsync([
                  "bash",
                  "-c",
                  `uptime -p | sed -e 's/...//;s/ day\\| days/d/;s/ hour\\| hours/h/;s/ minute\\| minutes/m/;s/,[^,]*//2'`,
                ]);
              } catch {
                return execAsync(["bash", "-c", "uptime"]).then((output) => {
                  const uptimeRegex = /up\s+((\d+)\s+days?,\s+)?((\d+):(\d+)),/;
                  const matches = uptimeRegex.exec(output);

                  if (matches) {
                    const days = matches[2] ? parseInt(matches[2]) : 0;
                    const hours = matches[4] ? parseInt(matches[4]) : 0;
                    const minutes = matches[5] ? parseInt(matches[5]) : 0;

                    let formattedUptime = "";

                    if (days > 0) {
                      formattedUptime += `${days} d `;
                    }
                    if (hours > 0) {
                      formattedUptime += `${hours} h `;
                    }
                    formattedUptime += `${minutes} m`;

                    return formattedUptime;
                  } else {
                    throw new Error("Failed to parse uptime output");
                  }
                });
              }
            };

            self.poll(5000, (label) => {
              getUptime()
                .then((upTimeString) => {
                  label.label = `${getString("Uptime:")} ${upTimeString}`;
                })
                .catch((err) => {
                  console.error(`Failed to fetch uptime: ${err}`);
                });
            });
          },
        }),
      ],
    }),
    Widget.Box({ hexpand: true }),
    await ModulePowerIcon(),
  ],
});

const togglesBox = Widget.Box({
  hpack: "center",
  spacing: 8,
  className: "sidebar-togglesbox",
  children: [
    ToggleIconWifi(),
    ToggleIconBluetooth(),
    await ModuleNightLight(),
    await ModuleGameMode(),
    userOptions.asyncGet().sidebar.ModuleCalendar.enabled
      ? await ToggleIconCalendar()
      : null, // Add the calendar toggle here
    ModuleIdleInhibitor(),
    ModuleSettingsIcon(),
    await ModuleCloudflareWarp(),
  ],
});

export const sidebarOptionsStack = ExpandingIconTabContainer({
  tabsHpack: "center",
  tabSwitcherClassName: "sidebar-icontabswitcher",
  icons: getEnabledModules().map((api) => api.materialIcon),
  names: getEnabledModules().map((api) => api.name),
  children: getEnabledModules().map((api) => api.contentWidget()),
  onChange: (self, id) => {
    self.shown = getEnabledModules()[id].name;
    if (getEnabledModules()[id].onFocus) getEnabledModules()[id].onFocus();
  },
});
const getRandomImage = () => {
  try {
    const animeDir = `${GLib.get_home_dir()}/.config/ags/assets/anime`;
    const dir = Gio.File.new_for_path(animeDir);

    // List files in directory
    const enumerator = dir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null
    );
    const imageFiles = [];

    let fileInfo;
    while ((fileInfo = enumerator.next_file(null)) !== null) {
      const name = fileInfo.get_name();
      // Only add files with image extensions
      if (name.match(/\.(jpg|jpeg|png|gif)$/i)) {
        imageFiles.push(name.replace(/\.[^/.]+$/, "")); // Remove extension
      }
    }

    if (imageFiles.length === 0) return "1"; // fallback if no images

    // Get random image name
    const randomIndex = Math.floor(Math.random() * imageFiles.length);
    return imageFiles[randomIndex];
  } catch (error) {
    console.error("Error getting random image:", error);
    return "1"; // fallback to default
  }
};

export const selectedImage = getRandomImage();

const Cat = Widget.Button({
  onClicked: () => {
    App.closeWindow("sideright");
    Utils.execAsync([
      "bash",
      "-c",
      `${GLib.get_home_dir()}/.local/bin/ags-tweaks`,
    ]);
  },
  child: Widget.Icon({
    hpack: "end",
    hexpand: "true",
    icon: selectedImage || "1",
    css: `font-size:7rem;margin-bottom:1rem`,
    className: "txt sec-txt txt-massive",
  }),
});

let topArea = Box({
  vertical: true,
  vpack: "center",
  css: `margin-bottom:0.5rem`,
  className: "spacing-v-5",
  children: [timeRow, togglesBox],
});
let content = Box({
  vertical: true,
  vexpand: true,
  className: `${elevate}`,
  children: [
    Overlay({
      className: "spacing-v-5",
      child: userOptions.asyncGet().sidebar.showAnimeCat
        ? Cat
        : Box({ css: `min-height:8rem;` }),
      overlays: [topArea],
    }),
    Box({
      className: "sidebar-group",
      vexpand: true,
      children: [sidebarOptionsStack],
    }),
    userOptions.asyncGet().sidebar.ModuleCalendar.enabled
      ? calendarRevealer
      : null,
  ],
});
export default () =>
  Box({
    vexpand: true,
    hexpand: true,
    css: `${userOptions.asyncGet().sidebar.extraCss}`,
    children: [
      EventBox({
        onPrimaryClick: () => App.closeWindow("sideright"),
        onSecondaryClick: () => App.closeWindow("sideright"),
        onMiddleClick: () => App.closeWindow("sideright"),
      }),
      Box({
        vexpand: true,
        children: [
          userOptions.asyncGet().etc.widgetCorners
            ? Box({
                vertical: true,
                children: [
                  RoundedCorner("topright", {
                    className: "corner corner-colorscheme",
                  }),
                  Box({ vexpand: true }),
                  RoundedCorner("bottomright", {
                    className: "corner corner-colorscheme",
                  }),
                ],
              })
            : null,
          content,
        ],
      }),
    ],
    setup: (self) =>
      self.on("key-press-event", (widget, event) => {
        // Handle keybinds
        if (
          checkKeybind(
            event,
            userOptions.asyncGet().keybinds.sidebar.options.nextTab
          )
        ) {
          sidebarOptionsStack.nextTab();
        } else if (
          checkKeybind(
            event,
            userOptions.asyncGet().keybinds.sidebar.options.prevTab
          )
        ) {
          sidebarOptionsStack.prevTab();
        }
      }),
  });
