## ADDED Requirements

### Requirement: Setup guide document
The system SHALL include a `docs/google-photos-setup.md` file with step-by-step instructions for configuring Google Photos integration. The guide SHALL be written for users who are not familiar with Google Cloud Console.

#### Scenario: User reads setup guide
- **WHEN** a user opens `docs/google-photos-setup.md`
- **THEN** they find instructions covering: creating a Google Cloud project, enabling the Photos Library API, creating OAuth2 credentials (web application type), configuring the authorized redirect URI, and setting environment variables

### Requirement: Google Cloud project creation instructions
The guide SHALL explain how to create a new Google Cloud project and enable the Photos Library API.

#### Scenario: Creating a project
- **WHEN** the user follows the project creation section
- **THEN** the guide directs them to console.cloud.google.com, explains how to create a new project (suggest name "pOS Photos"), navigate to "APIs & Services > Library", search for "Photos Library API", and click Enable

### Requirement: OAuth credentials configuration instructions
The guide SHALL explain how to create OAuth2 web application credentials and configure the consent screen.

#### Scenario: Configuring OAuth consent screen
- **WHEN** the user follows the consent screen section
- **THEN** the guide directs them to "APIs & Services > OAuth consent screen", select "External" user type, fill in app name ("pOS Photos"), user support email, and developer contact email. The guide SHALL note that the app will be in "Testing" mode (limited to 100 test users) unless published, and explain how to add their Google account as a test user

#### Scenario: Creating credentials
- **WHEN** the user follows the credentials section
- **THEN** the guide directs them to "APIs & Services > Credentials", click "Create Credentials > OAuth client ID", select "Web application", set name to "pOS Photos", add authorized redirect URI `http://localhost:8000/api/photos/sources/google/callback`, and copy the client ID and client secret

### Requirement: Environment variable configuration instructions
The guide SHALL explain which environment variables to set and where to set them.

#### Scenario: Setting environment variables
- **WHEN** the user follows the env var section
- **THEN** the guide lists the three required variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (defaulting to `http://localhost:8000/api/photos/sources/google/callback`), and explains where to set them (`.env` file in the photos service directory or export in shell)

### Requirement: Verification instructions
The guide SHALL include a section explaining how to verify the setup is working.

#### Scenario: User verifies configuration
- **WHEN** the user follows the verification section
- **THEN** the guide tells them to restart the photos service, open pOS Photos, click the settings cog, click "Add Source", and verify that "Google Photos" appears as an option. It SHALL explain that clicking "Connect Google Photos" will redirect to Google's consent screen

### Requirement: Troubleshooting section
The guide SHALL include common issues and solutions.

#### Scenario: User encounters redirect_uri_mismatch
- **WHEN** the user checks the troubleshooting section for redirect errors
- **THEN** they find an explanation that the redirect URI in Google Console MUST exactly match the one the backend sends, including protocol and port (http://localhost:8000), and how to fix it

#### Scenario: User encounters access_denied
- **WHEN** the user checks the troubleshooting section for access denied
- **THEN** they find an explanation that their Google account must be added as a test user in the OAuth consent screen while the app is in "Testing" mode

#### Scenario: Google Photos option not showing
- **WHEN** the user checks the troubleshooting section for missing provider
- **THEN** they find instructions to verify `GOOGLE_CLIENT_ID` is set by checking `/api/photos/sources/providers` endpoint response
