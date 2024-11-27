const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const Player = require("../model/Player.model");
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_ACCESS_TIME = process.env.JWT_ACCESS_TIME;

const { google } = require('googleapis');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

exports.oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  'postmessage'
);
// Passport Google OAuth 2.0 Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL // Replace with your redirect URI
},
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if player already exists
      let player = await Player.findOne({ email: profile.emails[0].value });

      if (!player) {
        // If not, create a new player with the Google profile
        player = new Player({
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          email: profile.emails[0].value,
        });
        await player.save();
      }

      // Create JWT token
      const token = jwt.sign({ playerId: player._id }, JWT_ACCESS_SECRET, {
        expiresIn: JWT_ACCESS_TIME,
      });

      return done(null, { player, token });
    } catch (error) {
      return done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

