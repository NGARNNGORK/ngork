
import {
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import { firebaseConfig, auth } from "./firebase-config.js";

const body = document.body;
const logoutButton = document.getElementById("logout-button");
const photoInput = document.getElementById("profile-photo-input");

body.classList.add("auth-checking");

const configured = firebaseConfig.apiKey && firebaseConfig.projectId;

if (!configured) {
  window.location.replace("login.html");
} else {
  try {
    window.ngorkAuth = auth;

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

      const profileName = document.getElementById("profile-name");
      const topAvatar = document.getElementById("user-avatar");
      const greeting = document.getElementById("greeting");

      if (profileName) profileName.textContent = display;

      const profile = document.getElementById("sidebar-profile");
      const small = profile?.querySelector("small");

      if (small) small.textContent = user.email || "บัญชี NGORK";

      if (greeting && user.displayName) {
        greeting.textContent = `สวัสดี, ${user.displayName} ✦`;
      }

      function showPhoto(url, name = display) {
        document.querySelectorAll("[data-profile-image]").forEach((img) => {
          if (url) {
            img.src = url;
            img.hidden = false;
          } else {
            img.removeAttribute("src");
            img.hidden = true;
          }
        });

        document.querySelectorAll("[data-profile-initial]").forEach((el) => {
          el.textContent = (name || "N").trim().charAt(0).toUpperCase() || "N";
          el.hidden = Boolean(url);
        });

        if (topAvatar) topAvatar.title = "เปลี่ยนรูปโปรไฟล์";
      }

      showPhoto(user.photoURL, display);

      document.querySelectorAll("[data-profile-photo]").forEach((button) => {
        button.onclick = () => photoInput?.click();
      });

      if (photoInput && !photoInput.dataset.bound) {
        photoInput.dataset.bound = "true";

        photoInput.addEventListener("change", async () => {
          const file = photoInput.files?.[0];
          if (!file) return;

          if (!file.type.startsWith("image/")) {
            alert("กรุณาเลือกไฟล์รูปภาพ");
            photoInput.value = "";
            return;
          }

          if (file.size > 5 * 1024 * 1024) {
            alert("รูปต้องมีขนาดไม่เกิน 5 MB");
            photoInput.value = "";
            return;
          }

          const reader = new FileReader();

          reader.onload = async () => {
            try {
              const imageUrl = reader.result;

              // แสดงรูปทันทีในทั้งสองตำแหน่ง
              showPhoto(imageUrl, display);

              // บันทึกข้อมูลรูปลง Firebase Authentication
              await updateProfile(user, { photoURL: imageUrl });

              alert("เปลี่ยนรูปโปรไฟล์แล้ว");
            } catch (error) {
              console.error("Profile photo error:", error);
              showPhoto(user.photoURL, display);
              alert("บันทึกรูปไม่สำเร็จ โปรดลองอีกครั้ง");
            } finally {
              photoInput.value = "";
            }
          };

          reader.onerror = () => {
            alert("อ่านไฟล์รูปไม่สำเร็จ");
            photoInput.value = "";
          };

          reader.readAsDataURL(file);
        });
      }
    });
  } catch (error) {
    console.error("Firebase auth guard error:", error);
    window.location.replace("login.html");
  }
}
