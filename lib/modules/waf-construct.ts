import * as waf from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

interface WafConstructProps {
  block?: waf.CfnWebACL.BlockActionProperty;
  scope: string;
  name?: string;
  visibilityConfig: waf.CfnWebACL.VisibilityConfigProperty;
  ruleName: string;
  priority: number;
  action: waf.CfnWebACL.RuleActionProperty;
  statement: waf.CfnWebACL.StatementProperty;
  resourceArn: string;
}

export class WafContruct extends Construct {
  constructor(scope: Construct, id: string, props: WafConstructProps) {
    super(scope, id);

    const defaultActionProperty: waf.CfnWebACL.DefaultActionProperty = {
      block: props.block,
    };

    const wafRules: waf.CfnWebACL.RuleProperty[] = [
      {
        name: props.ruleName,
        priority: props.priority,
        action: props.action,
        statement: props.statement,
        visibilityConfig: props.visibilityConfig,
      },
    ];

    const customWaf = new waf.CfnWebACL(this, "waf", {
      defaultAction: defaultActionProperty,
      scope: props.scope,
      name: props.name,
      visibilityConfig: props.visibilityConfig,
      rules: wafRules,
    });

    const wafAclAssociation: waf.CfnWebACLAssociation =
      new waf.CfnWebACLAssociation(this, "wafAclAssociation", {
        webAclArn: customWaf.attrArn,
        resourceArn: props.resourceArn,
      });
  }
}
