# Bondada Foundation — GoDaddy submission fix

## Frontend contract reviewed

The React form sends one multipart request to:

`POST /api/v1/scholarships/applications`

The multipart fields are:
- `application` — JSON string
- `aadharFile`
- `photoFile`
- `marksFile`
- `incomeCertificate`
- `bankPassbook`
- `rationCardFile`

The JSON contains `scholarshipCode`, personal/family/bank fields, employee-referral fields, and a dynamic `academic` object. The backend in this package preserves that contract; the frontend does not need a field-by-field SQL schema for academic data.

## Important diagnosis

A `GET /api/v1/scholarships/applications/check?...` returning `200` proves the backend route and database lookup are reachable. The screenshot's `POST /applications` `500` is therefore a backend processing failure, not a browser CORS failure.

The submission path is:

1. validate JSON + six files
2. resolve scholarship program
3. reserve the program application number
4. create the application + academic JSON + initial status history
5. upload six documents to R2 and create their document records
6. return success

If the POST is still `500` while the check endpoint says `found: true`, the old code had already inserted the application and then failed during the R2/document phase. This rebuilt version logs the exact storage/SQL phase and compensates by deleting uploaded objects and the just-created application on failure.

## Database design

`scholarship_academic_details.academic_data` stays JSON deliberately. The frontend's `scholarshipConfig.js` defines different academic fields for each program. Creating columns for every possible academic field would make every frontend field change require a DB migration.

## Existing production database

Do NOT import the fresh schema over the existing production database. Your existing `bondada_foundation` database already contains data and stored procedures. Use the rebuilt procedure file to replace procedure definitions, then deploy the backend.

## GoDaddy production secrets

Configure production secrets in GoDaddy's Secrets UI. Do not commit real secrets into the ZIP. Numeric values are entered as text in the GoDaddy UI.

Recommended DB host: `184.168.104.138` (the dedicated IP of the separate MySQL plan). The Node.js hosting server IP must remain allowed under Remote MySQL on the database plan.
