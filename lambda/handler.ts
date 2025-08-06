import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { createHash } from "crypto";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const tableName = "urlMapping";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    if (event.body) {
      // post request with long URL to shorten
      const requestBody = JSON.parse(event.body);
      if (!requestBody.longUrl) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            message: "Missing longUrl in request body",
          }),
        };
      }
      const longUrl = requestBody.longUrl;
      let shortUrl = createHash("md5").update(longUrl).digest("hex");

      for (let i = 7; i < shortUrl.length; i++) {
        const currentShortUrl = shortUrl.substring(0, i);
        try {
          const getCommand = new GetCommand({
            TableName: tableName,
            Key: { shortUrl: currentShortUrl },
          });
          const res = await docClient.send(getCommand);
          if (!res.Item) {
            shortUrl = currentShortUrl;
            break;
          }
        } catch (error) {
          console.error("Error checking existing short URL:", error);
          shortUrl = currentShortUrl;
          break;
        }
      }

      const putCommand = new PutCommand({
        TableName: tableName,
        Item: {
          shortUrl,
          longUrl,
        },
      });

      await docClient.send(putCommand);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          shortUrl,
          longUrl,
        }),
      };
    } else {
      // get request with short URL to redirect to the long URL

      const shortUrl = event.pathParameters?.short_url;

      if (!shortUrl) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "short_url parameter is required" }),
        };
      }

      const getCommand = new GetCommand({
        TableName: tableName,
        Key: { shortUrl },
      });
      const res = await docClient.send(getCommand);

      if (!res.Item) {
        return {
          statusCode: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Short URL not found" }),
        };
      }
      const longUrl = res.Item.longUrl;

      return {
        statusCode: 302,
        headers: {
          "Access-Control-Allow-Origin": "*",
          Location: longUrl,
        },
        body: "",
      };
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Internal Server Error",
      }),
    };
  }
};
