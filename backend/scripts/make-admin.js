// Grants or removes admin access for a registered account.
//
//   npm run make-admin -- someone@example.com
//   npm run make-admin -- someone@example.com --remove
//   npm run make-admin -- --list

require("dotenv").config({ quiet: true, path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { User, connectDB } = require("../db");

async function main() {
  const args = process.argv.slice(2);
  const list = args.includes("--list");
  const remove = args.includes("--remove");
  const email = args.find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();

  if (!list && !email) {
    console.log("Usage: npm run make-admin -- <email> [--remove] | --list");
    process.exitCode = 1;
    return;
  }

  if (!(await connectDB())) {
    process.exitCode = 1;
    return;
  }

  if (list) {
    const admins = await User.find({ role: "admin" }).select("name email").lean();

    console.log(
      admins.length
        ? admins.map((admin) => `${admin.email} (${admin.name})`).join("\n")
        : "No admins yet."
    );
    return;
  }

  const user = await User.findOneAndUpdate(
    { email },
    { role: remove ? "user" : "admin" },
    { returnDocument: "after" }
  );

  if (!user) {
    console.log(`No account found for ${email}. Sign up on the website first.`);
    process.exitCode = 1;
    return;
  }

  console.log(
    remove
      ? `${user.email} is no longer an admin.`
      : `${user.email} (${user.name}) is now an admin.`
  );
}

main().finally(() => mongoose.disconnect());
