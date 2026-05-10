export class AppSettings {
  static readonly ENABLE_MULTI_AZ = false;
  static readonly ENABLE_PUBLIC_IP = false;
  static readonly ENABLE_EXECUTE_COMMAND = true;
  static readonly ENABLE_CROSS_ZONE_LB = true;
  static readonly ALLOW_ALL_OUTBOUND = true;
  static readonly CREATE_INTERNET_GATEWAY = true;
  static readonly PRIVATE_DNS_ENABLED = true;
  static readonly EMPTY_ECR_ON_DELETE = true;
  static readonly ENABLE_POINT_IN_TIME_RECOVERY = true;
  static readonly ENABLE_STORAGE_ENCRYPTION = true;
  static readonly ENABLE_AUTO_MINOR_VERSION_UPGRADE = true;
  static readonly ENABLE_CLOUDWATCH_METRICS = true;
  static readonly ENABLE_SAMPLED_REQUESTS = true;
  static readonly ENABLE_STOPPED_DEPLOYMENT_NOTIFICATION = true;
  static readonly ENABLE_FAILED_DEPLOYMENT_NOTIFICATION = true;
  static readonly ENABLE_DEPLOYMENT_IN_ALARM_NOTIFICATION = true;
}
