
import {
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import { firebaseConfig, auth } from "./firebase-config.js";


const $ = (id) => document.getElementById(id);
const form = $("auth-form");
const loginTab = $("login-tab");
const signupTab = $("signup-tab");
const nameGroup = $("name-group");
const confirmGroup = $("confirm-group");
const loginOptions = $("login-options");
const message = $("auth-message");
const submitButton = $("submit-button");
const submitLabel = $("submit-label");
const googleButton = $("google-button");
let mode = "login";
let googleProvider = null;

function showMessage(text, success = false) {
  message.textContent = text;
  message.classList.toggle("success", success);
}
function setBusy(busy, label = "กำลังดำเนินการ...") {
  submitButton.disabled = busy;
  googleButton.disabled = busy;
  submitLabel.textContent = busy ? label : (mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี NGORK");
}
function setMode(nextMode) {
  mode = nextMode;
  const signup = mode === "signup";
  loginTab.classList.toggle("active", !signup);
  signupTab.classList.toggle("active", signup);
  nameGroup.hidden = !signup;
  confirmGroup.hidden = !signup;
  loginOptions.hidden = signup;
  $("form-title").textContent = signup ? "มาเริ่มต้นไปด้วยกัน!" : "กลับมาแล้ว ยินดีต้อนรับ!";
  $("form-subtitle").textContent = signup ? "สร้างบัญชีเพื่อเริ่มจัดการงานของคุณ" : "เข้าสู่ระบบเพื่อไปจัดการงานของคุณต่อ";
  $("password").autocomplete = signup ? "new-password" : "current-password";
  $("submit-label").textContent = signup ? "สร้างบัญชี NGORK" : "เข้าสู่ระบบ";
  $("toggle-password").textContent = "แสดงรหัสผ่าน";
  $("password").type = "password";
  showMessage("");
}
function friendlyError(error) {
  const code = error?.code || "";
  const map = {
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง ลองตรวจสอบอีกครั้ง",
    "auth/missing-password": "กรุณากรอกรหัสผ่าน",
    "auth/weak-password": "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
    "auth/email-already-in-use": "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน",
    "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/user-not-found": "ยังไม่พบบัญชีนี้ กรุณาสมัครสมาชิกก่อน",
    "auth/wrong-password": "รหัสผ่านไม่ถูกต้อง",
    "auth/popup-closed-by-user": "ปิดหน้าต่าง Google ก่อนเข้าสู่ระบบเสร็จ",
    "auth/popup-blocked": "เบราว์เซอร์บล็อกหน้าต่าง Google โปรดอนุญาตป๊อปอัปแล้วลองใหม่",
    "auth/unauthorized-domain": "โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication > Settings",
    "auth/network-request-failed": "เชื่อมต่ออินเทอร์เน็ตไม่สำเร็จ ลองอีกครั้ง",
    "auth/operation-not-allowed": "ยังไม่ได้เปิดวิธีเข้าสู่ระบบนี้ใน Firebase Console",
    "auth/too-many-requests": "ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"
  };
  return map[code] || `ดำเนินการไม่สำเร็จ (${code || "unknown"}) กรุณาตรวจสอบการตั้งค่า Firebase แล้วลองใหม่`;
}
function ensureConfigured() {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("ใส่_") || !firebaseConfig.projectId || firebaseConfig.projectId.includes("ใส่_")) {
    throw new Error("ยังไม่ได้ตั้งค่า Firebase กรุณาใส่ค่าจริงในไฟล์ firebase-config.js ก่อน");
  }
}

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));
$("toggle-password").addEventListener("click", () => {
  const input = $("password");
  const visible = input.type === "password";
  input.type = visible ? "text" : "password";
  $("toggle-password").textContent = visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน";
});
$("forgot-password").addEventListener("click", async () => {
  const email = $("email").value.trim();
  if (!email) return showMessage("กรอกอีเมลก่อน แล้วค่อยกดลืมรหัสผ่าน");
  try {
    ensureConfigured();
    if (!auth) throw new Error("ยังเชื่อมต่อ Firebase ไม่สำเร็จ");
    await sendPasswordResetEmail(auth, email);
    showMessage("ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว โปรดตรวจสอบอีเมลของคุณ", true);
  } catch (error) { showMessage(error.message?.startsWith("ยังไม่ได้ตั้งค่า") ? error.message : friendlyError(error)); }
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  const email = $("email").value.trim();
  const password = $("password").value;
  const name = $("display-name").value.trim();
  try {
    ensureConfigured();
    if (!auth) throw new Error("ยังเชื่อมต่อ Firebase ไม่สำเร็จ");
    if (mode === "signup") {
      if (!name) return showMessage("กรุณากรอกชื่อที่อยากให้เรียก");
      if (password.length < 6) return showMessage("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      if (password !== $("confirm-password").value) return showMessage("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      setBusy(true, "กำลังสร้างบัญชี...");
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
    } else {
      setBusy(true, "กำลังเข้าสู่ระบบ...");
      await signInWithEmailAndPassword(auth, email, password);
    }
    window.location.replace("dashboard.html");
  } catch (error) {
    showMessage(error.message?.startsWith("ยังไม่ได้ตั้งค่า") || error.message?.startsWith("ยังเชื่อมต่อ") ? error.message : friendlyError(error));
    setBusy(false);
  }
});
googleButton.addEventListener("click", async () => {
  showMessage("");
  try {
    ensureConfigured();
    if (!auth) throw new Error("ยังเชื่อมต่อ Firebase ไม่สำเร็จ");
    setBusy(true, "กำลังเข้าสู่ระบบ...");
    await signInWithPopup(auth, googleProvider);
    window.location.replace("dashboard.html");
  } catch (error) {
    showMessage(error.message?.startsWith("ยังไม่ได้ตั้งค่า") || error.message?.startsWith("ยังเชื่อมต่อ") ? error.message : friendlyError(error));
    setBusy(false);
  }
});


try {
  ensureConfigured();
  googleProvider = new GoogleAuthProvider();

  await setPersistence(
    auth,
    $("remember").checked
      ? browserLocalPersistence
      : browserSessionPersistence
  );

  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.replace("dashboard.html");
    }
  });
} catch (error) {
  showMessage(error.message || "ตั้งค่า Firebase ไม่สำเร็จ");
}

