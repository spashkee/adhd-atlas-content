import {
  createSign,
} from "node:crypto";


function fail(message) {
  throw new Error(message);
}


function getOptions() {
  const args =
    process.argv.slice(2);

  const options = {
    data: {},
  };


  for (
    let index = 0;
    index < args.length;
    index += 1
  ) {
    const arg =
      args[index];


    if (arg === "--data") {
      const value =
        args[index + 1];

      if (!value) {
        fail(
          "Missing value after --data."
        );
      }


      const separator =
        value.indexOf("=");


      if (separator <= 0) {
        fail(
          "--data must use key=value."
        );
      }


      const key =
        value
          .slice(
            0,
            separator
          )
          .trim();

      const dataValue =
        value
          .slice(
            separator + 1
          );


      if (!key) {
        fail(
          "FCM data key cannot be empty."
        );
      }


      options.data[key] =
        dataValue;

      index += 1;

      continue;
    }


    if (
      !arg.startsWith("--")
    ) {
      fail(
        `Unexpected argument: ${arg}`
      );
    }


    const name =
      arg.slice(2);

    const value =
      args[index + 1];


    if (
      !value ||
      value.startsWith("--")
    ) {
      fail(
        `Missing value after ${arg}.`
      );
    }


    options[name] =
      value;

    index += 1;
  }


  return options;
}


function requiredString(
  value,
  label,
  maximumLength = 500,
) {
  const normalized =
    String(
      value ?? ""
    ).trim();


  if (
    !normalized ||
    normalized.length >
      maximumLength
  ) {
    fail(
      `${label} is invalid.`
    );
  }


  return normalized;
}


function base64UrlJson(
  value,
) {
  return Buffer
    .from(
      JSON.stringify(
        value
      ),
      "utf8"
    )
    .toString(
      "base64url"
    );
}


function parseServiceAccount() {
  const raw =
    process.env
      .FIREBASE_SERVICE_ACCOUNT_JSON;


  if (!raw) {
    fail(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing."
    );
  }


  let value;


  try {
    value =
      JSON.parse(
        raw
      );
  } catch {
    fail(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON."
    );
  }


  const projectId =
    requiredString(
      value.project_id,
      "service account project_id",
      200,
    );

  const clientEmail =
    requiredString(
      value.client_email,
      "service account client_email",
      500,
    );

  const privateKey =
    requiredString(
      value.private_key,
      "service account private_key",
      10000,
    );

  const tokenUri =
    requiredString(
      value.token_uri ??
        "https://oauth2.googleapis.com/token",
      "service account token_uri",
      1000,
    );


  return {
    projectId,
    clientEmail,
    privateKey,
    tokenUri,
  };
}


async function getAccessToken(
  serviceAccount,
) {
  const now =
    Math.floor(
      Date.now() / 1000
    );


  const header =
    base64UrlJson({
      alg: "RS256",
      typ: "JWT",
    });


  const payload =
    base64UrlJson({
      iss:
        serviceAccount.clientEmail,

      scope:
        "https://www.googleapis.com/auth/firebase.messaging",

      aud:
        serviceAccount.tokenUri,

      iat:
        now,

      exp:
        now + 3600,
    });


  const unsignedToken =
    `${header}.${payload}`;


  const signer =
    createSign(
      "RSA-SHA256"
    );


  signer.update(
    unsignedToken
  );

  signer.end();


  const signature =
    signer
      .sign(
        serviceAccount.privateKey
      )
      .toString(
        "base64url"
      );


  const assertion =
    `${unsignedToken}.${signature}`;


  const response =
    await fetch(
      serviceAccount.tokenUri,
      {
        method: "POST",

        headers: {
          "content-type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            grant_type:
              "urn:ietf:params:oauth:grant-type:jwt-bearer",

            assertion,
          }),
      }
    );


  const result =
    await response.json();


  if (
    !response.ok ||
    typeof result.access_token !==
      "string"
  ) {
    fail(
      `Unable to obtain Google access token: ${response.status}`
    );
  }


  return result.access_token;
}


async function main() {
  const options =
    getOptions();


  const topic =
    requiredString(
      options.topic,
      "topic",
      900,
    );


  if (
    !/^[A-Za-z0-9\-_.~%]+$/
      .test(
        topic
      )
  ) {
    fail(
      "FCM topic contains unsupported characters."
    );
  }


  const title =
    requiredString(
      options.title,
      "title",
      200,
    );


  const body =
    requiredString(
      options.body,
      "body",
      500,
    );


  const dataOnlyValue =
    String(
      options["data-only"] ??
        "false"
    )
      .trim()
      .toLowerCase();


  if (
    dataOnlyValue !== "true" &&
    dataOnlyValue !== "false"
  ) {
    fail(
      "--data-only must be true or false."
    );
  }


  const dataOnly =
    dataOnlyValue === "true";


  const messageData = {
    ...options.data,
  };


  if (dataOnly) {
    messageData.title = title;
    messageData.body = body;
  }


  const message = {
    topic,

    data:
      messageData,

    android: {
      priority:
        "high",

      ttl:
        "86400s",
    },
  };


  if (!dataOnly) {
    message.notification = {
      title,
      body,
    };

    message.android.notification = {
      sound:
        "default",
    };
  }


  const serviceAccount =
    parseServiceAccount();


  const accessToken =
    await getAccessToken(
      serviceAccount
    );


  const response =
    await fetch(
      "https://fcm.googleapis.com/" +
        `v1/projects/${encodeURIComponent(serviceAccount.projectId)}/messages:send`,
      {
        method: "POST",

        headers: {
          authorization:
            `Bearer ${accessToken}`,

          "content-type":
            "application/json",
        },

        body:
          JSON.stringify({
            message,
          }),
      }
    );


  const result =
    await response.json();


  if (!response.ok) {
    console.error(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    fail(
      `FCM send failed: HTTP ${response.status}`
    );
  }


  console.log(
    "FCM message sent successfully."
  );


  if (
    typeof result.name ===
      "string"
  ) {
    console.log(
      result.name
    );
  }
}


await main();