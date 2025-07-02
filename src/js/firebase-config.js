import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
const firebaseConfig = {
    apiKey: "AIzaSyCvYycOyGC18l2seBmdfGYhKJm-qAFUDvw",
    authDomain: "virtual-ai-login.firebaseapp.com",
    projectId: "virtual-ai-login",
    storageBucket: "virtual-ai-login.firebasestorage.app",
    messagingSenderId: "436979666592",
    appId: "1:436979666592:web:0e5ab706244657e0a8c3c5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export { auth };