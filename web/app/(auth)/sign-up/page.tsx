import { redirect } from "next/navigation";

// There is no self sign-up: accounts are created by the Super Admin (Users > Invite) and passwords are set there or under
// Change Password. The old Sign Up form saved nothing, so people who used it to "reset" a password then couldn't sign in.
// Old links and bookmarks land on Sign In.
export default function SignUpPage() {
  redirect("/sign-in");
}
