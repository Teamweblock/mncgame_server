const nodemailer = require("nodemailer");

// Create a reusable transporter for nodemailer
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASSWORD, // Your Gmail App Password or regular password (if no 2FA)
    },
  });
};

// Function to send a reset password email
const sendResetPasswordEmail = async (toEmail, token) => {
  // Set up email options
  const resetLink = `${process.env.FRONTEND_URL}/resetaPassword/${token}`;
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: toEmail,
    subject: "Reset your password",
    html: `
      <p>Click on the link below to reset your password:</p>
      <br/>
      <a href="${resetLink}">Reset Password</a>
      <br/><br/>
      <p>If you did not request this, please ignore this email.</p>
      <p>Thank you.</p>
      <p>Team OEP</p>
    `,
  };

  // Send the email using the transporter
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response); // Optional logging
  } catch (error) {
    console.error("Error sending email: ", error);
    throw new Error("Error sending password reset email");
  }
};

// Function to send a Invite password email
const sendGameInviteEmail = async (toEmail, teamName) => {
  // Set up email options
  const InviteLink = `${process.env.FRONTEND_URL}/welcomepagegame3`;
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: toEmail,
    subject: `Invitation to join the game: ${teamName}`,
    html: `You have been invited to join the team "${teamName}". Click the link to join:  <a href="${InviteLink}">Strategy Trial</a>`,
  };

  // Send the email using the transporter
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response); // Optional logging
  } catch (error) {
    console.error("Error sending email: ", error);
    throw new Error("Error sending Invite email");
  }
};

module.exports = {
  sendResetPasswordEmail,
  sendGameInviteEmail
};
