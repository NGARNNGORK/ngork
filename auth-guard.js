
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import { firebaseConfig, auth } from "./firebase-config.js";


const body = document.body;
const logoutButton = document.getElementById("logout-button");

body.classList.add("auth-checking");

const configured =
  firebaseConfig.apiKey &&
  firebaseConfig.projectId;

if (!configured) {
  window.location.replace("login.html");
} else {
  try {
    window.ngorkAuth = auth;

    // ป้องกันการผูกปุ่มออกจากระบบซ้ำ
    logoutButton?.addEventListener("click", async () => {
      logoutButton.disabled = true;

      try {
        await signOut(auth);
        window.location.replace("login.html");
      } catch (error) {
        console.error("Logout error:", error);
        logoutButton.disabled = false;
        alert("ออกจากระบบไม่สำเร็จ โปรดลองอีกครั้ง");
      }
    });

    onAuthStateChanged(auth, (user) => {
      if (!user) {
  window.location.replace("login.html");
  return;
}

window.dispatchEvent(
  new CustomEvent("ngork-user-ready", {
    detail: { uid: user.uid }
  })
);

      body.classList.remove("auth-checking");

      const display =
        user.displayName ||
        (user.email ? user.email.split("@")[0] : "นักเรียน");

      const avatar = document.getElementById("user-avatar");

      if (avatar) {
        avatar.textContent = display.slice(0, 1).toUpperCase();
        avatar.title = user.email || display;
      }

      const profile = document.querySelector(".profile");

      if (profile) {
        const strong = profile.querySelector("strong");
        const small = profile.querySelector("small");
        const avatarEl = profile.querySelector(".avatar");

        if (strong) strong.textContent = display;
        if (small) small.textContent = user.email || "บัญชี NGORK";
        if (avatarEl) {
          avatarEl.textContent = display.slice(0, 1).toUpperCase();
        }
      }

      const greeting = document.getElementById("greeting");

      if (greeting && user.displayName) {
        greeting.textContent = `สวัสดี, ${user.displayName} ✦`;
      }
    });
  } catch (error) {
    console.error("Firebase auth guard error:", error);
    window.location.replace("login.html");
  }
}
