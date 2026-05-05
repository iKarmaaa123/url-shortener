import * as waf from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

interface WafConstructProps {
  block?: waf.CfnWebACL.BlockActionProperty;
  responseCode: number;
  scope: string;
  name?: string;
  ruleName: string;
  priority: number;
  resourceArn: string;
  cloudWatchMetricsEnabled: boolean;
  metricName: string;
  sampledRequestsEnabled: true;
  countryCodes: string[];
}

export class WafContruct extends Construct {
  constructor(scope: Construct, id: string, props: WafConstructProps) {
    super(scope, id);

    const defaultActionProperty: waf.CfnWebACL.DefaultActionProperty = {
      block: {
        customResponse: {
          responseCode: props.responseCode,
        },
      },
    };

    const wafRules: waf.CfnWebACL.RuleProperty[] = [
      {
        name: props.ruleName,
        priority: props.priority,
        action: {
          allow: {},
        },
        statement: {
          geoMatchStatement: {
            countryCodes: ["US", "GB"],
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: props.cloudWatchMetricsEnabled,
          metricName: props.metricName,
          sampledRequestsEnabled: props.sampledRequestsEnabled,
        },
      },
    ];

    const customWaf = new waf.CfnWebACL(this, "waf", {
      defaultAction: defaultActionProperty,
      scope: props.scope,
      name: props.name,
      visibilityConfig: {
        cloudWatchMetricsEnabled: props.cloudWatchMetricsEnabled,
        metricName: props.metricName,
        sampledRequestsEnabled: props.sampledRequestsEnabled,
        },
      rules: wafRules,
    });

    new waf.CfnWebACLAssociation(this, "wafAclAssociation", {
      webAclArn: customWaf.attrArn,
      resourceArn: props.resourceArn,
    });
  }
}
