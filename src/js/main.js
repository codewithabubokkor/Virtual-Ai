import { auth } from './firebase-config';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { FacebookAuthProvider } from 'firebase/auth';

document.addEventListener('DOMContentLoaded', () => {
    //sign up
    const signUp = document.getElementById('signup-form');

    if (signUp) {
        signUp.addEventListener('submit', function (e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;


            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredentail) => {
                    const user = userCredentail.user;
                    alert("User account create successfull ", user);
                    window.location.href = 'index.html';
                }).catch((error) => {
                    alert("Error: " + error.message);
                });
        });

    }

    //login

    const login = document.getElementById('login-form');

    if (login) {
        login.addEventListener('submit', function (e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            signInWithEmailAndPassword(auth, email, password)
                .then((userCredentail) => {
                    const user = userCredentail.user;
                    console.log("User login successful:", user.uid);


                    sessionStorage.setItem('currentUser', JSON.stringify({
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || user.email.split('@')[0]
                    }));


                    window.location.href = '/public/chatbot.html';
                }).catch((error) => {
                    alert("Error: " + error.message);
                });
        });
    }
    //google login
    const google = document.getElementById('google-login');
    if (google) {
        google.addEventListener('click', function (e) {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider).then((result) => {
                const user = result.user;
                console.log("Google login successful:", user.uid);


                sessionStorage.setItem('currentUser', JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0]
                }));

                window.location.href = '/public/chatbot.html';
            }).catch((error) => {
                alert("Error: " + error.message);
            });
        });
    }


    // Facebook login
    const facebookLoginButton = document.getElementById('facebook-login');
    if (facebookLoginButton) {
        facebookLoginButton.addEventListener('click', () => {
            const provider = new FacebookAuthProvider();
            signInWithPopup(auth, provider)
                .then((result) => {
                    const user = result.user;
                    console.log('Facebook User:', user);


                    sessionStorage.setItem('currentUser', JSON.stringify({
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || user.email.split('@')[0]
                    }));

                    window.location.href = '/public/chatbot.html';
                })
                .catch((error) => {
                    alert('Error: ' + error.message);
                });
        });
    }
});
