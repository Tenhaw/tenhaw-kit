// Generated from spec/schemas. Tests enforce equality.
export const schemas = {
  "delivery-events": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/delivery-events.schema.json",
    "type": "array",
    "items": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "type": {
              "const": "commit"
            },
            "timestamp": {
              "type": "string",
              "format": "date-time"
            },
            "service": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "id",
            "type",
            "timestamp",
            "service"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "type": {
              "const": "deployment"
            },
            "timestamp": {
              "type": "string",
              "format": "date-time"
            },
            "service": {
              "type": "string",
              "minLength": 1
            },
            "environment": {
              "type": "string",
              "minLength": 1
            },
            "commitIds": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "status": {
              "type": "string",
              "enum": [
                "success",
                "failed"
              ]
            },
            "rework": {
              "type": "boolean"
            },
            "proxy": {
              "type": "boolean"
            }
          },
          "required": [
            "id",
            "type",
            "timestamp",
            "service",
            "environment",
            "commitIds",
            "status"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "type": {
              "const": "incident"
            },
            "startedAt": {
              "type": "string",
              "format": "date-time"
            },
            "restoredAt": {
              "type": "string",
              "format": "date-time"
            },
            "service": {
              "type": "string",
              "minLength": 1
            },
            "deploymentId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "id",
            "type",
            "startedAt",
            "service",
            "deploymentId"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "type": {
              "const": "work-item"
            },
            "startedAt": {
              "type": "string",
              "format": "date-time"
            },
            "completedAt": {
              "type": "string",
              "format": "date-time"
            },
            "service": {
              "type": "string",
              "minLength": 1
            },
            "activeMinutes": {
              "type": "number",
              "minimum": 0
            }
          },
          "required": [
            "id",
            "type",
            "startedAt",
            "service"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "type": {
              "const": "pull-request"
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "firstReviewAt": {
              "type": "string",
              "format": "date-time"
            },
            "mergedAt": {
              "type": "string",
              "format": "date-time"
            },
            "service": {
              "type": "string",
              "minLength": 1
            },
            "additions": {
              "type": "integer",
              "minimum": 0
            },
            "deletions": {
              "type": "integer",
              "minimum": 0
            }
          },
          "required": [
            "id",
            "type",
            "createdAt",
            "service"
          ],
          "additionalProperties": false
        }
      ]
    },
    "maxItems": 50000
  },
  "delivery-health": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/delivery-health.schema.json",
    "type": "object",
    "properties": {
      "status": {
        "const": "informational"
      },
      "metrics": {
        "type": "object",
        "properties": {
          "deploymentFrequency": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "deployments/day"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "changeLeadTime": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "hours"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "changeFailRate": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0,
                "maximum": 100
              },
              "unit": {
                "const": "percent"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "failedDeploymentRecoveryTime": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "hours"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "deploymentReworkRate": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0,
                "maximum": 100
              },
              "unit": {
                "const": "percent"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "cycleTime": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "hours"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "throughput": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "items/week"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "wip": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "items at period end"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "flowEfficiency": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0,
                "maximum": 100
              },
              "unit": {
                "const": "percent"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "prReviewTime": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "hours"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "prSize": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "changed lines"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          }
        },
        "required": [
          "deploymentFrequency",
          "changeLeadTime",
          "changeFailRate",
          "failedDeploymentRecoveryTime",
          "deploymentReworkRate",
          "cycleTime",
          "throughput",
          "wip",
          "flowEfficiency",
          "prReviewTime",
          "prSize"
        ],
        "additionalProperties": false
      },
      "actions": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "minItems": 1,
        "maxItems": 3
      },
      "limitations": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "sources": {
        "type": "array",
        "items": {
          "type": "string",
          "format": "uri"
        }
      }
    },
    "required": [
      "status",
      "metrics",
      "actions",
      "limitations",
      "sources"
    ],
    "additionalProperties": false
  },
  "delivery-report": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/delivery-report.schema.json",
    "type": "object",
    "properties": {
      "period": {
        "type": "object",
        "properties": {
          "since": {
            "type": "string",
            "format": "date-time"
          },
          "until": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "since",
          "until"
        ],
        "additionalProperties": false
      },
      "metrics": {
        "type": "object",
        "properties": {
          "deploymentFrequency": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "deployments/day"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "changeLeadTime": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "hours"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "changeFailRate": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0,
                "maximum": 100
              },
              "unit": {
                "const": "percent"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "failedDeploymentRecoveryTime": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "hours"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "deploymentReworkRate": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0,
                "maximum": 100
              },
              "unit": {
                "const": "percent"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "cycleTime": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "hours"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "throughput": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "items/week"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "wip": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "items at period end"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "flowEfficiency": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0,
                "maximum": 100
              },
              "unit": {
                "const": "percent"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "prReviewTime": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "hours"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          },
          "prSize": {
            "type": "object",
            "properties": {
              "value": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "unit": {
                "const": "changed lines"
              },
              "sampleSize": {
                "type": "integer",
                "minimum": 0
              },
              "period": {
                "type": "object",
                "properties": {
                  "since": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "until": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "since",
                  "until"
                ],
                "additionalProperties": false
              },
              "dataSource": {
                "const": "supplied events"
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "value",
              "unit",
              "sampleSize",
              "period",
              "dataSource",
              "caveats"
            ],
            "additionalProperties": false
          }
        },
        "required": [
          "deploymentFrequency",
          "changeLeadTime",
          "changeFailRate",
          "failedDeploymentRecoveryTime",
          "deploymentReworkRate",
          "cycleTime",
          "throughput",
          "wip",
          "flowEfficiency",
          "prReviewTime",
          "prSize"
        ],
        "additionalProperties": false
      },
      "caveats": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "period",
      "metrics",
      "caveats"
    ],
    "additionalProperties": false
  },
  "interaction": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/interaction.schema.json",
    "type": "object",
    "properties": {
      "from": {
        "type": "string",
        "minLength": 1
      },
      "to": {
        "type": "string",
        "minLength": 1
      },
      "mode": {
        "type": "string",
        "enum": [
          "collaboration",
          "X-as-a-Service",
          "facilitating"
        ]
      }
    },
    "required": [
      "from",
      "to",
      "mode"
    ],
    "additionalProperties": false
  },
  "okr": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/okr.schema.json",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "minLength": 1
      },
      "objective": {
        "type": "string",
        "minLength": 1
      },
      "teamId": {
        "type": "string",
        "minLength": 1
      },
      "keyResults": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "description": {
              "type": "string",
              "minLength": 1
            },
            "baseline": {
              "type": "number"
            },
            "target": {
              "type": "number"
            },
            "current": {
              "type": "number"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            }
          },
          "required": [
            "id",
            "description",
            "baseline",
            "target",
            "current",
            "confidence"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "id",
      "objective",
      "keyResults"
    ],
    "additionalProperties": false
  },
  "opmodel-report": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/opmodel-report.schema.json",
    "type": "object",
    "properties": {
      "model": {
        "type": "object",
        "properties": {
          "teams": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1
                },
                "name": {
                  "type": "string",
                  "minLength": 1
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "stream-aligned",
                    "platform",
                    "enabling",
                    "complicated-subsystem"
                  ]
                },
                "size": {
                  "type": "integer",
                  "minimum": 1
                },
                "cognitiveLoad": {
                  "type": "string",
                  "enum": [
                    "low",
                    "medium",
                    "high"
                  ]
                },
                "platformDependencies": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1
                  }
                }
              },
              "required": [
                "id",
                "name",
                "type",
                "size"
              ],
              "additionalProperties": false
            }
          },
          "okrs": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1
                },
                "objective": {
                  "type": "string",
                  "minLength": 1
                },
                "teamId": {
                  "type": "string",
                  "minLength": 1
                },
                "keyResults": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "minLength": 1
                      },
                      "description": {
                        "type": "string",
                        "minLength": 1
                      },
                      "baseline": {
                        "type": "number"
                      },
                      "target": {
                        "type": "number"
                      },
                      "current": {
                        "type": "number"
                      },
                      "confidence": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                      },
                      "progress": {
                        "type": "number"
                      }
                    },
                    "required": [
                      "id",
                      "description",
                      "baseline",
                      "target",
                      "current",
                      "confidence",
                      "progress"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "id",
                "objective",
                "keyResults"
              ],
              "additionalProperties": false
            }
          },
          "roadmap": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1
                },
                "title": {
                  "type": "string",
                  "minLength": 1
                },
                "horizon": {
                  "type": "string",
                  "enum": [
                    "now",
                    "next",
                    "later"
                  ]
                },
                "outcome": {
                  "type": "string"
                },
                "teamId": {
                  "type": "string",
                  "minLength": 1
                },
                "okrId": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "id",
                "title",
                "horizon"
              ],
              "additionalProperties": false
            }
          },
          "interactions": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "from": {
                  "type": "string",
                  "minLength": 1
                },
                "to": {
                  "type": "string",
                  "minLength": 1
                },
                "mode": {
                  "type": "string",
                  "enum": [
                    "collaboration",
                    "X-as-a-Service",
                    "facilitating"
                  ]
                }
              },
              "required": [
                "from",
                "to",
                "mode"
              ],
              "additionalProperties": false
            }
          },
          "products": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1
                },
                "name": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "id",
                "name"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "teams",
          "okrs",
          "roadmap",
          "interactions",
          "products"
        ],
        "additionalProperties": false
      },
      "checks": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "code": {
              "type": "string"
            },
            "entityId": {
              "type": "string"
            },
            "message": {
              "type": "string"
            }
          },
          "required": [
            "code",
            "entityId",
            "message"
          ],
          "additionalProperties": false
        }
      },
      "limitations": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "sources": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "model",
      "checks",
      "limitations",
      "sources"
    ],
    "additionalProperties": false
  },
  "opmodel": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/opmodel.schema.json",
    "type": "object",
    "properties": {
      "teams": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "name": {
              "type": "string",
              "minLength": 1
            },
            "type": {
              "type": "string",
              "enum": [
                "stream-aligned",
                "platform",
                "enabling",
                "complicated-subsystem"
              ]
            },
            "size": {
              "type": "integer",
              "minimum": 1
            },
            "cognitiveLoad": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ]
            },
            "platformDependencies": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            }
          },
          "required": [
            "id",
            "name",
            "type",
            "size"
          ],
          "additionalProperties": false
        }
      },
      "okrs": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "objective": {
              "type": "string",
              "minLength": 1
            },
            "teamId": {
              "type": "string",
              "minLength": 1
            },
            "keyResults": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "description": {
                    "type": "string",
                    "minLength": 1
                  },
                  "baseline": {
                    "type": "number"
                  },
                  "target": {
                    "type": "number"
                  },
                  "current": {
                    "type": "number"
                  },
                  "confidence": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  }
                },
                "required": [
                  "id",
                  "description",
                  "baseline",
                  "target",
                  "current",
                  "confidence"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "id",
            "objective",
            "keyResults"
          ],
          "additionalProperties": false
        }
      },
      "roadmap": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "title": {
              "type": "string",
              "minLength": 1
            },
            "horizon": {
              "type": "string",
              "enum": [
                "now",
                "next",
                "later"
              ]
            },
            "outcome": {
              "type": "string"
            },
            "teamId": {
              "type": "string",
              "minLength": 1
            },
            "okrId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "id",
            "title",
            "horizon"
          ],
          "additionalProperties": false
        }
      },
      "interactions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "from": {
              "type": "string",
              "minLength": 1
            },
            "to": {
              "type": "string",
              "minLength": 1
            },
            "mode": {
              "type": "string",
              "enum": [
                "collaboration",
                "X-as-a-Service",
                "facilitating"
              ]
            }
          },
          "required": [
            "from",
            "to",
            "mode"
          ],
          "additionalProperties": false
        }
      },
      "products": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "name": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "id",
            "name"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "teams"
    ],
    "additionalProperties": false
  },
  "project-cost-input": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/project-cost-input.schema.json",
    "type": "object",
    "properties": {
      "stage": {
        "enum": [
          "poc",
          "pilot",
          "production"
        ]
      },
      "people": {
        "type": "number",
        "exclusiveMinimum": 0
      },
      "durationWeeks": {
        "type": "number",
        "exclusiveMinimum": 0
      },
      "dayRate": {
        "type": "number",
        "exclusiveMinimum": 0
      },
      "currency": {
        "type": "string",
        "pattern": "^[A-Z]{3}$"
      }
    },
    "required": [
      "stage"
    ],
    "additionalProperties": false
  },
  "project-cost-report": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/project-cost-report.schema.json",
    "type": "object",
    "properties": {
      "stage": {
        "enum": [
          "poc",
          "pilot",
          "production"
        ]
      },
      "currency": {
        "type": "string"
      },
      "low": {
        "type": "number",
        "minimum": 0
      },
      "high": {
        "type": "number",
        "minimum": 0
      },
      "assumptions": {
        "type": "object",
        "properties": {
          "people": {
            "type": "number",
            "minimum": 0
          },
          "dayRate": {
            "type": "number",
            "minimum": 0
          },
          "workingDaysPerWeek": {
            "const": 5
          },
          "weeksLow": {
            "type": "number",
            "minimum": 0
          },
          "weeksHigh": {
            "type": "number",
            "minimum": 0
          }
        },
        "required": [
          "people",
          "dayRate",
          "workingDaysPerWeek",
          "weeksLow",
          "weeksHigh"
        ],
        "additionalProperties": false
      },
      "limitations": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "stage",
      "currency",
      "low",
      "high",
      "assumptions",
      "limitations"
    ],
    "additionalProperties": false
  },
  "readiness-questionnaire": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/readiness-questionnaire.schema.json",
    "type": "object",
    "properties": {
      "version": {
        "const": "v1"
      },
      "dimensions": {
        "type": "array",
        "items": {
          "type": "object"
        },
        "minItems": 6,
        "maxItems": 6
      },
      "bands": {
        "type": "array",
        "items": {
          "type": "object"
        }
      },
      "minimumBandCoverage": {
        "const": 0.8
      },
      "limitations": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "contentCredit": {
        "const": "Tenhaw AI Readiness Framework, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), https://tenhaw.com."
      }
    },
    "required": [
      "version",
      "dimensions",
      "bands",
      "minimumBandCoverage",
      "limitations",
      "contentCredit"
    ],
    "additionalProperties": false
  },
  "readiness-report": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/readiness-report.schema.json",
    "type": "object",
    "properties": {
      "frameworkVersion": {
        "const": "v1"
      },
      "overall": {
        "type": [
          "number",
          "null"
        ],
        "minimum": 1,
        "maximum": 5
      },
      "band": {
        "type": [
          "string",
          "null"
        ],
        "enum": [
          "Exploring",
          "Experimenting",
          "Scaling",
          "Embedded",
          "Leading",
          null
        ]
      },
      "coverage": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
      },
      "dimensions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "label": {
              "type": "string"
            },
            "weight": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            "score": {
              "type": [
                "number",
                "null"
              ],
              "minimum": 1,
              "maximum": 5
            },
            "answered": {
              "type": "integer",
              "minimum": 0
            },
            "total": {
              "const": 5
            },
            "coverage": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            }
          },
          "required": [
            "id",
            "label",
            "weight",
            "score",
            "answered",
            "total",
            "coverage"
          ],
          "additionalProperties": false
        },
        "minItems": 6,
        "maxItems": 6
      },
      "gaps": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "questionId": {
              "type": "string"
            },
            "dimensionId": {
              "type": "string"
            },
            "score": {
              "type": "integer",
              "minimum": 1,
              "maximum": 2
            },
            "priority": {
              "type": "number",
              "minimum": 0
            },
            "recommendation": {
              "type": "string"
            }
          },
          "required": [
            "questionId",
            "dimensionId",
            "score",
            "priority",
            "recommendation"
          ],
          "additionalProperties": false
        }
      },
      "recommendations": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "questionId": {
              "type": "string"
            },
            "action": {
              "type": "string"
            }
          },
          "required": [
            "questionId",
            "action"
          ],
          "additionalProperties": false
        }
      },
      "limitations": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "contentCredit": {
        "const": "Tenhaw AI Readiness Framework, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), https://tenhaw.com."
      }
    },
    "required": [
      "frameworkVersion",
      "overall",
      "band",
      "coverage",
      "dimensions",
      "gaps",
      "recommendations",
      "limitations",
      "contentCredit"
    ],
    "additionalProperties": false
  },
  "readiness-response": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/readiness-response.schema.json",
    "type": "object",
    "properties": {
      "answers": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "questionId": {
              "type": "string",
              "pattern": "^(strategy|data|technology|people|governance|delivery)-[1-5]$"
            },
            "score": {
              "type": "integer",
              "minimum": 1,
              "maximum": 5
            },
            "evidence": {
              "type": "string"
            }
          },
          "required": [
            "questionId",
            "score"
          ],
          "additionalProperties": false
        },
        "maxItems": 30
      }
    },
    "required": [
      "answers"
    ],
    "additionalProperties": false
  },
  "roadmap-item": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/roadmap-item.schema.json",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "minLength": 1
      },
      "title": {
        "type": "string",
        "minLength": 1
      },
      "horizon": {
        "type": "string",
        "enum": [
          "now",
          "next",
          "later"
        ]
      },
      "outcome": {
        "type": "string"
      },
      "teamId": {
        "type": "string",
        "minLength": 1
      },
      "okrId": {
        "type": "string",
        "minLength": 1
      }
    },
    "required": [
      "id",
      "title",
      "horizon"
    ],
    "additionalProperties": false
  },
  "roi-input": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/roi-input.schema.json",
    "type": "object",
    "properties": {
      "useCase": {
        "type": "string",
        "minLength": 1
      },
      "users": {
        "type": "number",
        "minimum": 0
      },
      "minutesPerTask": {
        "type": "number",
        "minimum": 0
      },
      "tasksPerUserPerMonth": {
        "type": "number",
        "minimum": 0
      },
      "savings": {
        "type": "object",
        "properties": {
          "low": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "base": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "high": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          }
        },
        "required": [
          "low",
          "base",
          "high"
        ],
        "additionalProperties": false
      },
      "hourlyCost": {
        "type": "number",
        "minimum": 0
      },
      "buildCost": {
        "type": "number",
        "minimum": 0
      },
      "monthlyRunCost": {
        "type": "number",
        "minimum": 0
      },
      "adoptionMonths": {
        "type": "integer",
        "minimum": 0,
        "maximum": 1200
      },
      "horizonMonths": {
        "type": "integer",
        "minimum": 1,
        "maximum": 1200
      },
      "annualDiscountRate": {
        "type": "number",
        "minimum": 0,
        "maximum": 10
      },
      "cashRealisation": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
      },
      "currency": {
        "type": "string",
        "pattern": "^[A-Z]{3}$"
      }
    },
    "required": [
      "useCase",
      "users",
      "minutesPerTask",
      "tasksPerUserPerMonth",
      "savings",
      "hourlyCost",
      "buildCost",
      "monthlyRunCost",
      "adoptionMonths",
      "horizonMonths",
      "annualDiscountRate",
      "cashRealisation",
      "currency"
    ],
    "additionalProperties": false
  },
  "roi-report": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/roi-report.schema.json",
    "type": "object",
    "properties": {
      "currency": {
        "type": "string"
      },
      "assumptions": {
        "type": "object",
        "properties": {
          "cashRealisation": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "capacityIsCash": {
            "const": false
          }
        },
        "required": [
          "cashRealisation",
          "capacityIsCash"
        ],
        "additionalProperties": false
      },
      "scenarios": {
        "type": "object",
        "properties": {
          "low": {
            "type": "object",
            "properties": {
              "monthlyCashFlow": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "month": {
                      "type": "integer",
                      "minimum": 1
                    },
                    "adoption": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 1
                    },
                    "hoursSaved": {
                      "type": "number",
                      "minimum": 0
                    },
                    "potentialValue": {
                      "type": "number",
                      "minimum": 0
                    },
                    "cashBenefit": {
                      "type": "number",
                      "minimum": 0
                    },
                    "runCost": {
                      "type": "number",
                      "minimum": 0
                    },
                    "netCashFlow": {
                      "type": "number"
                    },
                    "cumulativeCashFlow": {
                      "type": "number"
                    }
                  },
                  "required": [
                    "month",
                    "adoption",
                    "hoursSaved",
                    "potentialValue",
                    "cashBenefit",
                    "runCost",
                    "netCashFlow",
                    "cumulativeCashFlow"
                  ],
                  "additionalProperties": false
                }
              },
              "totalCashBenefit": {
                "type": "number",
                "minimum": 0
              },
              "totalRunCost": {
                "type": "number",
                "minimum": 0
              },
              "totalHoursSaved": {
                "type": "number",
                "minimum": 0
              },
              "recoveredCapacityHours": {
                "type": "number",
                "minimum": 0
              },
              "npv": {
                "type": "number"
              },
              "paybackMonth": {
                "type": [
                  "integer",
                  "null"
                ],
                "minimum": 0
              },
              "roiPercent": {
                "type": [
                  "number",
                  "null"
                ]
              },
              "costPerTask": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "breakEvenAdoption": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              }
            },
            "required": [
              "monthlyCashFlow",
              "totalCashBenefit",
              "totalRunCost",
              "totalHoursSaved",
              "recoveredCapacityHours",
              "npv",
              "paybackMonth",
              "roiPercent",
              "costPerTask",
              "breakEvenAdoption"
            ],
            "additionalProperties": false
          },
          "base": {
            "type": "object",
            "properties": {
              "monthlyCashFlow": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "month": {
                      "type": "integer",
                      "minimum": 1
                    },
                    "adoption": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 1
                    },
                    "hoursSaved": {
                      "type": "number",
                      "minimum": 0
                    },
                    "potentialValue": {
                      "type": "number",
                      "minimum": 0
                    },
                    "cashBenefit": {
                      "type": "number",
                      "minimum": 0
                    },
                    "runCost": {
                      "type": "number",
                      "minimum": 0
                    },
                    "netCashFlow": {
                      "type": "number"
                    },
                    "cumulativeCashFlow": {
                      "type": "number"
                    }
                  },
                  "required": [
                    "month",
                    "adoption",
                    "hoursSaved",
                    "potentialValue",
                    "cashBenefit",
                    "runCost",
                    "netCashFlow",
                    "cumulativeCashFlow"
                  ],
                  "additionalProperties": false
                }
              },
              "totalCashBenefit": {
                "type": "number",
                "minimum": 0
              },
              "totalRunCost": {
                "type": "number",
                "minimum": 0
              },
              "totalHoursSaved": {
                "type": "number",
                "minimum": 0
              },
              "recoveredCapacityHours": {
                "type": "number",
                "minimum": 0
              },
              "npv": {
                "type": "number"
              },
              "paybackMonth": {
                "type": [
                  "integer",
                  "null"
                ],
                "minimum": 0
              },
              "roiPercent": {
                "type": [
                  "number",
                  "null"
                ]
              },
              "costPerTask": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "breakEvenAdoption": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              }
            },
            "required": [
              "monthlyCashFlow",
              "totalCashBenefit",
              "totalRunCost",
              "totalHoursSaved",
              "recoveredCapacityHours",
              "npv",
              "paybackMonth",
              "roiPercent",
              "costPerTask",
              "breakEvenAdoption"
            ],
            "additionalProperties": false
          },
          "high": {
            "type": "object",
            "properties": {
              "monthlyCashFlow": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "month": {
                      "type": "integer",
                      "minimum": 1
                    },
                    "adoption": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 1
                    },
                    "hoursSaved": {
                      "type": "number",
                      "minimum": 0
                    },
                    "potentialValue": {
                      "type": "number",
                      "minimum": 0
                    },
                    "cashBenefit": {
                      "type": "number",
                      "minimum": 0
                    },
                    "runCost": {
                      "type": "number",
                      "minimum": 0
                    },
                    "netCashFlow": {
                      "type": "number"
                    },
                    "cumulativeCashFlow": {
                      "type": "number"
                    }
                  },
                  "required": [
                    "month",
                    "adoption",
                    "hoursSaved",
                    "potentialValue",
                    "cashBenefit",
                    "runCost",
                    "netCashFlow",
                    "cumulativeCashFlow"
                  ],
                  "additionalProperties": false
                }
              },
              "totalCashBenefit": {
                "type": "number",
                "minimum": 0
              },
              "totalRunCost": {
                "type": "number",
                "minimum": 0
              },
              "totalHoursSaved": {
                "type": "number",
                "minimum": 0
              },
              "recoveredCapacityHours": {
                "type": "number",
                "minimum": 0
              },
              "npv": {
                "type": "number"
              },
              "paybackMonth": {
                "type": [
                  "integer",
                  "null"
                ],
                "minimum": 0
              },
              "roiPercent": {
                "type": [
                  "number",
                  "null"
                ]
              },
              "costPerTask": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "breakEvenAdoption": {
                "type": [
                  "number",
                  "null"
                ],
                "minimum": 0
              }
            },
            "required": [
              "monthlyCashFlow",
              "totalCashBenefit",
              "totalRunCost",
              "totalHoursSaved",
              "recoveredCapacityHours",
              "npv",
              "paybackMonth",
              "roiPercent",
              "costPerTask",
              "breakEvenAdoption"
            ],
            "additionalProperties": false
          }
        },
        "required": [
          "low",
          "base",
          "high"
        ],
        "additionalProperties": false
      },
      "topDrivers": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "value": {
              "type": "number"
            }
          },
          "required": [
            "name",
            "value"
          ],
          "additionalProperties": false
        },
        "minItems": 3,
        "maxItems": 3
      },
      "limitations": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "currency",
      "assumptions",
      "scenarios",
      "topDrivers",
      "limitations"
    ],
    "additionalProperties": false
  },
  "team": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/team.schema.json",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "minLength": 1
      },
      "name": {
        "type": "string",
        "minLength": 1
      },
      "type": {
        "type": "string",
        "enum": [
          "stream-aligned",
          "platform",
          "enabling",
          "complicated-subsystem"
        ]
      },
      "size": {
        "type": "integer",
        "minimum": 1
      },
      "cognitiveLoad": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high"
        ]
      },
      "platformDependencies": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      }
    },
    "required": [
      "id",
      "name",
      "type",
      "size"
    ],
    "additionalProperties": false
  },
  "usecase-register-report": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/usecase-register-report.schema.json",
    "type": "object",
    "properties": {
      "useCases": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "title": {
              "type": "string",
              "minLength": 1
            },
            "problem": {
              "type": "string",
              "minLength": 1
            },
            "ownerRole": {
              "type": "string",
              "minLength": 1
            },
            "businessUnit": {
              "type": "string",
              "minLength": 1
            },
            "value": {
              "type": "number",
              "minimum": 0,
              "maximum": 5
            },
            "feasibility": {
              "type": "number",
              "minimum": 0,
              "maximum": 5
            },
            "riskTier": {
              "type": "string",
              "enum": [
                "prohibited",
                "high",
                "limited",
                "minimal",
                "unknown"
              ]
            },
            "status": {
              "type": "string",
              "enum": [
                "idea",
                "assessed",
                "approved",
                "PoC",
                "pilot",
                "production",
                "retired"
              ]
            },
            "dataRequired": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "dataSensitivity": {
              "type": "string",
              "enum": [
                "public",
                "internal",
                "confidential",
                "restricted"
              ]
            },
            "valueHypothesis": {
              "type": "string"
            },
            "valueEstimate": {
              "type": "object"
            },
            "dependencies": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "kpis": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "reviewDate": {
              "type": "string",
              "format": "date"
            },
            "priority": {
              "type": "number",
              "minimum": 0,
              "maximum": 25
            },
            "governanceGate": {
              "enum": [
                "blocked",
                "review-required",
                "standard-review"
              ]
            }
          },
          "required": [
            "id",
            "title",
            "problem",
            "ownerRole",
            "businessUnit",
            "value",
            "feasibility",
            "riskTier",
            "status",
            "priority",
            "governanceGate"
          ],
          "additionalProperties": false
        }
      },
      "methodology": {
        "type": "string"
      },
      "limitations": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "useCases",
      "methodology",
      "limitations"
    ],
    "additionalProperties": false
  },
  "usecase-register": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/usecase-register.schema.json",
    "type": "object",
    "properties": {
      "useCases": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "title": {
              "type": "string",
              "minLength": 1
            },
            "problem": {
              "type": "string",
              "minLength": 1
            },
            "ownerRole": {
              "type": "string",
              "minLength": 1
            },
            "businessUnit": {
              "type": "string",
              "minLength": 1
            },
            "value": {
              "type": "number",
              "minimum": 0,
              "maximum": 5
            },
            "feasibility": {
              "type": "number",
              "minimum": 0,
              "maximum": 5
            },
            "riskTier": {
              "type": "string",
              "enum": [
                "prohibited",
                "high",
                "limited",
                "minimal",
                "unknown"
              ]
            },
            "status": {
              "type": "string",
              "enum": [
                "idea",
                "assessed",
                "approved",
                "PoC",
                "pilot",
                "production",
                "retired"
              ]
            },
            "dataRequired": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "dataSensitivity": {
              "type": "string",
              "enum": [
                "public",
                "internal",
                "confidential",
                "restricted"
              ]
            },
            "valueHypothesis": {
              "type": "string"
            },
            "valueEstimate": {
              "type": "object"
            },
            "dependencies": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "kpis": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "reviewDate": {
              "type": "string",
              "format": "date"
            }
          },
          "required": [
            "id",
            "title",
            "problem",
            "ownerRole",
            "businessUnit",
            "value",
            "feasibility",
            "riskTier",
            "status"
          ],
          "additionalProperties": false
        },
        "maxItems": 10000
      }
    },
    "required": [
      "useCases"
    ],
    "additionalProperties": false
  },
  "usecase": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kit.tenhaw.com/schemas/usecase.schema.json",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "minLength": 1
      },
      "title": {
        "type": "string",
        "minLength": 1
      },
      "problem": {
        "type": "string",
        "minLength": 1
      },
      "ownerRole": {
        "type": "string",
        "minLength": 1
      },
      "businessUnit": {
        "type": "string",
        "minLength": 1
      },
      "value": {
        "type": "number",
        "minimum": 0,
        "maximum": 5
      },
      "feasibility": {
        "type": "number",
        "minimum": 0,
        "maximum": 5
      },
      "riskTier": {
        "type": "string",
        "enum": [
          "prohibited",
          "high",
          "limited",
          "minimal",
          "unknown"
        ]
      },
      "status": {
        "type": "string",
        "enum": [
          "idea",
          "assessed",
          "approved",
          "PoC",
          "pilot",
          "production",
          "retired"
        ]
      },
      "dataRequired": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "dataSensitivity": {
        "type": "string",
        "enum": [
          "public",
          "internal",
          "confidential",
          "restricted"
        ]
      },
      "valueHypothesis": {
        "type": "string"
      },
      "valueEstimate": {
        "type": "object"
      },
      "dependencies": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "kpis": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "reviewDate": {
        "type": "string",
        "format": "date"
      }
    },
    "required": [
      "id",
      "title",
      "problem",
      "ownerRole",
      "businessUnit",
      "value",
      "feasibility",
      "riskTier",
      "status"
    ],
    "additionalProperties": false
  }
} as const;
