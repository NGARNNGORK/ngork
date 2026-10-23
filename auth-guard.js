
import {
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

import { firebaseConfig, auth, db } from "./firebase-config.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const body = document.body;
const logoutButton = $("#logout-button");
const popover = $("#profile-popover");
const editButton = $("#edit-profile-btn");
const backdrop = $("#profile-modal-backdrop");
const closeButton = $("#close-profile-modal");
const cancelButton = $("#cancel-profile-edit");
const form = $("#profile-form");
const nameInput = $("#profile-name-input");
const photoInput = $("#profile-photo-file");

let currentUser = null;
let profilePhoto = "";
let selectedPhoto = "";
let currentName = "";
let profileBusy = false;

body.classList.add("auth-checking");

function showMessage(message) {
  const toast = $("#toast");
  if (toast) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
  } else {
    alert(message);
  }
}

function makeAvatar(container, photo, name) {
  if (!container) return;

  container.replaceChildren();

  if (photo) {
    const img = document.createElement("img");
    img.src = photo;
    img.alt = "รูปโปรไฟล์";
    img.style.cssText =
      "width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;";
    container.appendChild(img);
  } else {
    container.textContent =
      (name || "N").trim().charAt(0).toUpperCase() || "N";
  }
}

function renderProfile() {
  const displayName = currentName || "นักเรียน";

  // รูปที่มุมขวาบนและมุมล่างซ้าย
  makeAvatar($("#user-avatar"), profilePhoto, displayName);
  makeAvatar($(".profile .avatar"), profilePhoto, displayName);

  // รูปในแถบเมนูและหน้าต่างแก้ไข
  makeAvatar($("#popover-avatar"), profilePhoto, displayName);
  makeAvatar($("#profile-preview"), selectedPhoto || profilePhoto, displayName);

  const nameElement = $("#profile-name");
  if (nameElement) nameElement.textContent = displayName;

  const popoverName = $("#popover-name");
  if (popoverName) popoverName.textContent = displayName;

  const email = $("#popover-email");
  if (email) email.textContent = currentUser?.email || "บัญชี NGORK";

  if ($("#user-avatar")) $("#user-avatar").title = "โปรไฟล์ของฉัน";
}

function openProfileMenu() {
  if (!popover) return;
  popover.hidden = false;
}

function closeProfileMenu() {
  if (popover) popover.hidden = true;
}

function openEditor() {
  if (!backdrop || !currentUser) return;

  closeProfileMenu();
  nameInput.value = currentName;
  selectedPhoto = profilePhoto;
  if (photoInput) photoInput.value = "";

  renderProfile();
  backdrop.hidden = false;
  nameInput.focus();
}

function closeEditor() {
  if (backdrop) backdrop.hidden = true;
  selectedPhoto = "";
  if (photoInput) photoInput.value = "";
  renderProfile();
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("กรุณาเลือกไฟล์รูปภาพ");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("รูปต้นฉบับต้องไม่เกิน 5 MB");
  }

  const imageUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("อ่านรูปไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });

  const image = new Image();
  image.src = imageUrl;

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("เปิดรูปไม่สำเร็จ"));
  });

  const maxSide = 320;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  // ลดคุณภาพและขนาด เพื่อให้เหมาะกับ Firestore
  let quality = 0.65;
  let result = canvas.toDataURL("image/jpeg", quality);

  while (result.length > 350000 && quality > 0.25) {
    quality -= 0.1;
    result = canvas.toDataURL("image/jpeg", quality);
  }

  if (result.length > 350000) {
    throw new Error("รูปยังมีขนาดใหญ่เกินไป กรุณาเลือกรูปอื่น");
  }

  return result;
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
      await signOut(auth);
      window.location.replace("login.html");
    } catch (error) {
      console.error(error);
      logoutButton.disabled = false;
      showMessage("ออกจากระบบไม่สำเร็จ");
    }
  });
}

// กดโปรไฟล์ตำแหน่งใดก็ได้เพื่อเปิดแถบเมนู
$$("[data-profile-photo], #sidebar-profile, #user-avatar").forEach((element) => {
  element.addEventListener("click", (event) => {
    event.stopPropagation();
    if (popover && !popover.hidden) {
      closeProfileMenu();
    } else {
      openProfileMenu();
    }
  });
});

document.addEventListener("click", (event) => {
  if (
    popover &&
    !popover.hidden &&
    !popover.contains(event.target) &&
    !event.target.closest("[data-profile-photo]") &&
    !event.target.closest("#sidebar-profile") &&
    !event.target.closest("#user-avatar")
  ) {
    closeProfileMenu();
  }
});

editButton?.addEventListener("click", openEditor);
closeButton?.addEventListener("click", closeEditor);
cancelButton?.addEventListener("click", closeEditor);

backdrop?.addEventListener("click", (event) => {
  if (event.target === backdrop) closeEditor();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeProfileMenu();
    closeEditor();
  }
});

photoInput?.addEventListener("change", async () => {
  const file = photoInput.files?.[0];
  if (!file) return;

  try {
    selectedPhoto = await compressImage(file);
    renderProfile();
  } catch (error) {
    showMessage(error.message || "เลือกรูปไม่สำเร็จ");
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser || profileBusy) return;

  const newName = nameInput.value.trim();

  if (!newName) {
    showMessage("กรุณากรอกชื่อ");
    return;
  }

  if (newName.length > 50) {
    showMessage("ชื่อต้องไม่เกิน 50 ตัวอักษร");
    return;
  }

  profileBusy = true;
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    const profileRef = doc(db, "profiles", currentUser.uid);

    await setDoc(profileRef, {
      displayName: newName,
      photoData: selectedPhoto || "",
      updatedAt: new Date().toISOString()
    }, { merge: true });

    await updateProfile(currentUser, {
      displayName: newName
    });

    currentName = newName;
    profilePhoto = selectedPhoto;
    selectedPhoto = "";

    renderProfile();
    closeEditor();
    showMessage("บันทึกโปรไฟล์เรียบร้อยแล้ว");
  } catch (error) {
    console.error("Profile save error:", error);
    showMessage(
      error.code === "permission-denied"
        ? "Firestore Rules ยังไม่อนุญาตให้บันทึกโปรไฟล์"
        : "บันทึกไม่สำเร็จ ตรวจสอบการเชื่อมต่อและ Firestore Rules"
    );
  } finally {
    profileBusy = false;
    if (submitButton) submitButton.disabled = false;
  }
});

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  window.location.replace("login.html");
} else {
  window.ngorkAuth = auth;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace("login.html");
      return;
    }

    currentUser = user;

    try {
      const profileRef = doc(db, "profiles", user.uid);
      const snapshot = await getDoc(profileRef);
      const saved = snapshot.exists() ? snapshot.data() : {};

      currentName =
        saved.displayName ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "นักเรียน";

      profilePhoto = saved.photoData || "";

      // แจ้ง script.js ว่าผู้ใช้ผ่านการตรวจสอบแล้ว
      window.dispatchEvent(
        new CustomEvent("ngork-user-ready", {
          detail: { uid: user.uid }
        })
      );

      renderProfile();
      body.classList.remove("auth-checking");
    } catch (error) {
      console.error("Profile loading error:", error);
      body.classList.remove("auth-checking");
      showMessage("โหลดโปรไฟล์ไม่สำเร็จ กรุณาตรวจสอบ Firestore Rules");
    }
  });
}
