import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import path from "path";

export class ServerlessUrlShortenerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const shortnerFn = new cdk.aws_lambda.Function(this, "ShortnerFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda")),
    });

    const urlShortenerApi = new cdk.aws_apigateway.RestApi(
      this,
      "UrlShortenerApi",
      {
        restApiName: "Url Shortener Service",
        description: "This service shortens URLs.",
        defaultCorsPreflightOptions: {
          allowOrigins: apigateway.Cors.ALL_ORIGINS,
          allowMethods: apigateway.Cors.ALL_METHODS,
          allowHeaders: [
            "Content-Type",
            "X-Amz-Date",
            "Authorization",
            "X-Api-Key",
          ],
        },
      }
    );

    urlShortenerApi.root
      .addResource("create")
      .addMethod("POST", new apigateway.LambdaIntegration(shortnerFn));
    urlShortenerApi.root
      .addResource("{short_url}")
      .addMethod("GET", new apigateway.LambdaIntegration(shortnerFn));

    const dtable = new cdk.aws_dynamodb.TableV2(this, "UrlShortenerTable", {
      tableName: "urlMappingV2",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billing: cdk.aws_dynamodb.Billing.onDemand(),
      partitionKey: {
        name: "shortUrl",
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
    });
    dtable.grantReadWriteData(shortnerFn);

    // Output the API URL
    new cdk.CfnOutput(this, "ApiUrl", {
      value: urlShortenerApi.url,
      description: "URL Shortener API Gateway URL",
    });
  }
}
