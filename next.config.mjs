/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer", "twilio", "mongodb", "web-push"],
};

export default nextConfig;
