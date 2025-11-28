import { useState, useEffect, useRef } from 'react';

export default function DirecTVMCPExplorer() {
  const [selectedPlatform, setSelectedPlatform] = useState('sierra');
  const [chatInput, setChatInput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFlow, setActiveFlow] = useState(null);
  const [flowStep, setFlowStep] = useState(0);
  const [modalContent, setModalContent] = useState(null);
  const [comparisonMode, setComparisonMode] = useState('mcp');
  const chatEndRef = useRef(null);

  const platforms = {
    sierra: {
      name: 'Sierra',
      type: 'Chat',
      stats: { daily: '18K', containment: '70%' },
      color: '#00D4AA',
      tools: ['get_customer_profile', 'get_bill_history', 'compare_bills', 'get_offers', 'apply_offer', 'get_troubleshooting_flow', 'escalate_to_agent'],
      description: 'Customer-facing chat with transactional capabilities'
    },
    agentforce: {
      name: 'Agent Force',
      type: 'Agent Assist',
      stats: { daily: 'All agents', containment: 'N/A' },
      color: '#FF6B35',
      tools: ['get_customer_profile', 'get_bill_history', 'compare_bills', 'get_offers', 'apply_offer', 'get_troubleshooting_flow', 'schedule_technician', 'issue_credit'],
      description: 'Full capabilities for human agents via DTV360 Salesforce'
    },
    genesis: {
      name: 'Genesis',
      type: 'Voice IVR',
      stats: { monthly: '3.5M', containment: '22%' },
      color: '#7B68EE',
      tools: ['get_customer_profile', 'get_bill_history', 'compare_bills', 'get_offers', 'get_troubleshooting_flow', 'escalate_to_agent'],
      description: 'Voice IVR - read-only until validated (NLP bots migrating to Sierra)'
    },
    copilot: {
      name: 'Copilot',
      type: 'Internal',
      stats: { status: 'Future' },
      color: '#FFD93D',
      tools: ['get_customer_profile', 'get_bill_history', 'compare_bills', 'get_offers', 'get_troubleshooting_flow', 'schedule_technician'],
      description: 'Future internal employee tools (ChatGPT/Copilot Studio TBD)'
    }
  };

  // Detailed MCP Server definitions with schemas
  const serverDefinitions = {
    VCG: {
      name: 'VCG Server',
      fullName: 'Video Customer Gateway',
      description: 'Aggregated customer interface providing snapshot of customer profile, packages, equipment, and account status. Primary identification layer.',
      color: '#00D4AA',
      icon: '👤',
      latency: '~50ms',
      sourceSystem: 'VCG Platform',
      apiGateway: 'MuleSoft',
      auth: {
        type: 'OAuth 2.0 + Session Token',
        tokenValidation: 'ForgeRock IDP',
        waf: 'Akamai + AWS WAF',
        clientAuth: 'Client ID + Client Secret per platform'
      },
      tools: [
        {
          name: 'get_customer_profile',
          description: 'Retrieve customer snapshot including identity, services, packages, equipment, and account status. Use to identify who the customer is and route to correct biller system.',
          platformAccess: {
            sierra: { enabled: true, rateLimit: '1000/min' },
            agentforce: { enabled: true, rateLimit: '2000/min' },
            genesis: { enabled: true, rateLimit: '5000/min' },
            copilot: { enabled: true, rateLimit: '500/min' }
          },
          schema: {
            name: 'get_customer_profile',
            description: 'Retrieve customer snapshot from VCG',
            parameters: {
              type: 'object',
              properties: {
                customer_id: { type: 'string', description: 'Customer account identifier' },
                session_token: { type: 'string', description: 'Valid session token from ForgeRock' }
              },
              required: ['customer_id', 'session_token']
            },
            returns: {
              customer_id: 'string',
              name: 'string',
              account_status: 'active | suspended | cancelled',
              customer_type: 'satellite | stream',
              biller_system: 'biller_1 | biller_2 | biller_3',
              packages: 'string[]',
              equipment: 'object[]',
              tenure_months: 'integer'
            }
          }
        }
      ],
      notes: [
        'VCG provides snapshot only — cannot answer "why" questions',
        'Use biller_system field to route subsequent billing queries',
        'Equipment list needed for troubleshooting flows'
      ]
    },
    Biller: {
      name: 'Biller Server',
      fullName: '3 Billing Systems (Satellite + Stream)',
      description: 'Unified interface to 3 separate biller systems. Provides bill history, comparisons, payment status, and transactional credits. Primary driver of escalations (40% of volume).',
      color: '#FF6B35',
      icon: '💳',
      latency: '~50ms per biller',
      sourceSystem: '3 Biller Platforms',
      apiGateway: 'MuleSoft',
      auth: {
        type: 'OAuth 2.0 + Session Token',
        tokenValidation: 'ForgeRock IDP',
        waf: 'Akamai + AWS WAF',
        clientAuth: 'Client ID + Client Secret per platform'
      },
      tools: [
        {
          name: 'get_bill_history',
          description: 'Retrieve 6-month billing history with line-item details. Routes to correct biller based on customer_type.',
          platformAccess: {
            sierra: { enabled: true, rateLimit: '1000/min' },
            agentforce: { enabled: true, rateLimit: '2000/min' },
            genesis: { enabled: true, rateLimit: '5000/min' },
            copilot: { enabled: true, rateLimit: '500/min' }
          },
          schema: {
            name: 'get_bill_history',
            description: 'Retrieve billing history for customer',
            parameters: {
              type: 'object',
              properties: {
                customer_id: { type: 'string' },
                biller_system: { type: 'string', description: 'From VCG profile' },
                months: { type: 'integer', default: 6 }
              },
              required: ['customer_id', 'biller_system']
            },
            returns: {
              bills: '[{ period, total, line_items[], due_date, payment_status }]'
            }
          }
        },
        {
          name: 'compare_bills',
          description: 'Compare current bill to previous. Returns itemized differences. Gateway orchestrates parallel calls to VCG + Biller + Offers.',
          platformAccess: {
            sierra: { enabled: true, rateLimit: '1000/min' },
            agentforce: { enabled: true, rateLimit: '2000/min' },
            genesis: { enabled: true, rateLimit: '5000/min' },
            copilot: { enabled: true, rateLimit: '500/min' }
          },
          schema: {
            name: 'compare_bills',
            description: 'Compare current vs previous bill with itemized changes',
            parameters: {
              type: 'object',
              properties: {
                customer_id: { type: 'string' }
              },
              required: ['customer_id']
            },
            returns: {
              current_total: 'number',
              previous_total: 'number',
              difference: 'number',
              changes: '[{ category, description, amount }]'
            }
          }
        },
        {
          name: 'issue_credit',
          description: 'Apply account credit for service issues. Agent-only capability.',
          platformAccess: {
            sierra: { enabled: false, reason: 'Customer-facing - requires agent' },
            agentforce: { enabled: true, rateLimit: '500/min' },
            genesis: { enabled: false, reason: 'Voice channel - not enabled' },
            copilot: { enabled: false, reason: 'Internal - not enabled' }
          },
          schema: {
            name: 'issue_credit',
            description: 'Apply credit to customer account (WRITE)',
            parameters: {
              type: 'object',
              properties: {
                customer_id: { type: 'string' },
                amount: { type: 'number' },
                reason_code: { type: 'string', enum: ['service_interruption', 'billing_error', 'retention', 'goodwill'] },
                agent_id: { type: 'string', description: 'Required for audit' }
              },
              required: ['customer_id', 'amount', 'reason_code', 'agent_id']
            },
            returns: {
              success: 'boolean',
              confirmation_number: 'string',
              new_balance: 'number'
            }
          }
        }
      ],
      notes: [
        '"Lower my bill" is #2 escalation driver',
        'Billing & payments = 40% of escalations',
        'Snowflake has billing data but 24hr lag — use direct API',
        'compare_bills orchestrates 3 parallel calls'
      ]
    },
    Offers: {
      name: 'Offers Server',
      fullName: 'Decisioning Engine',
      description: 'Real-time offer eligibility and fulfillment. First transactional (write) capability planned for 2026. Handles both offer details and offer acceptance.',
      color: '#7B68EE',
      icon: '🎁',
      latency: '~50ms',
      sourceSystem: 'Decisioning Engine',
      apiGateway: 'MuleSoft',
      auth: {
        type: 'OAuth 2.0 + Session Token',
        tokenValidation: 'ForgeRock IDP',
        waf: 'Akamai + AWS WAF',
        clientAuth: 'Client ID + Client Secret per platform'
      },
      tools: [
        {
          name: 'get_offers',
          description: 'Get real-time eligible offers based on customer profile, tenure, and history.',
          platformAccess: {
            sierra: { enabled: true, rateLimit: '1000/min' },
            agentforce: { enabled: true, rateLimit: '2000/min' },
            genesis: { enabled: true, rateLimit: '5000/min' },
            copilot: { enabled: true, rateLimit: '500/min' }
          },
          schema: {
            name: 'get_offers',
            description: 'Retrieve eligible offers for customer',
            parameters: {
              type: 'object',
              properties: {
                customer_id: { type: 'string' },
                context: { type: 'string', enum: ['retention', 'upsell', 'service_recovery', 'general'] }
              },
              required: ['customer_id']
            },
            returns: {
              offers: '[{ offer_id, name, description, monthly_value, duration_months }]'
            }
          }
        },
        {
          name: 'apply_offer',
          description: 'Apply offer to customer account. Transactional write-back. 2026 milestone.',
          platformAccess: {
            sierra: { enabled: true, rateLimit: '500/min', note: '2026 Q1' },
            agentforce: { enabled: true, rateLimit: '1000/min' },
            genesis: { enabled: false, reason: 'Validate in chat first' },
            copilot: { enabled: false, reason: 'Not customer-facing' }
          },
          schema: {
            name: 'apply_offer',
            description: 'Apply offer to customer account (WRITE)',
            parameters: {
              type: 'object',
              properties: {
                customer_id: { type: 'string' },
                offer_id: { type: 'string' },
                acceptance_channel: { type: 'string', enum: ['chat', 'voice', 'agent', 'web'] }
              },
              required: ['customer_id', 'offer_id', 'acceptance_channel']
            },
            returns: {
              success: 'boolean',
              confirmation_number: 'string',
              effective_date: 'string',
              new_monthly_total: 'number'
            }
          }
        }
      ],
      notes: [
        'First write capability for Sierra planned Q1 2026',
        'Today: Sierra provides links to self-service pages',
        'Must write back declined offers for analytics'
      ]
    },
    WFE: {
      name: 'WFE Server',
      fullName: 'Workflow Engine',
      description: 'Device troubleshooting and diagnostic flows. Provides guided step-by-step resolution paths based on equipment type and error codes.',
      color: '#FFD93D',
      icon: '🔧',
      latency: '~50ms',
      sourceSystem: 'Workflow Engine + Care Flows',
      apiGateway: 'MuleSoft',
      auth: {
        type: 'OAuth 2.0 + Session Token',
        tokenValidation: 'ForgeRock IDP',
        waf: 'Akamai + AWS WAF',
        clientAuth: 'Client ID + Client Secret per platform'
      },
      tools: [
        {
          name: 'get_troubleshooting_flow',
          description: 'Get guided diagnostic flow for equipment issues based on equipment type, error code, and symptom.',
          platformAccess: {
            sierra: { enabled: true, rateLimit: '1000/min' },
            agentforce: { enabled: true, rateLimit: '2000/min' },
            genesis: { enabled: true, rateLimit: '5000/min', note: 'Primary voice use case' },
            copilot: { enabled: true, rateLimit: '500/min' }
          },
          schema: {
            name: 'get_troubleshooting_flow',
            description: 'Retrieve diagnostic flow for equipment issue',
            parameters: {
              type: 'object',
              properties: {
                customer_id: { type: 'string' },
                equipment_id: { type: 'string', description: 'From VCG profile' },
                error_code: { type: 'string', description: 'e.g., 771, 775' },
                symptom: { type: 'string', enum: ['no_picture', 'no_sound', 'frozen', 'error_code', 'remote_not_working', 'recording_issue'] }
              },
              required: ['customer_id']
            },
            returns: {
              flow_id: 'string',
              current_step: 'integer',
              total_steps: 'integer',
              step_instruction: 'string',
              expected_outcomes: 'string[]',
              escalation_trigger: 'boolean'
            }
          }
        },
        {
          name: 'schedule_technician',
          description: 'Book service technician appointment. Agent-only for now.',
          platformAccess: {
            sierra: { enabled: false, reason: 'Requires agent validation' },
            agentforce: { enabled: true, rateLimit: '500/min' },
            genesis: { enabled: false, reason: 'Transfer to agent' },
            copilot: { enabled: true, rateLimit: '200/min', note: 'Internal scheduling' }
          },
          schema: {
            name: 'schedule_technician',
            description: 'Schedule technician visit (WRITE)',
            parameters: {
              type: 'object',
              properties: {
                customer_id: { type: 'string' },
                issue_type: { type: 'string', enum: ['installation', 'repair', 'upgrade', 'relocation'] },
                preferred_date: { type: 'string' },
                preferred_window: { type: 'string', enum: ['morning', 'afternoon', 'evening'] },
                agent_id: { type: 'string' }
              },
              required: ['customer_id', 'issue_type']
            },
            returns: {
              success: 'boolean',
              confirmation_number: 'string',
              scheduled_date: 'string',
              scheduled_window: 'string'
            }
          }
        }
      ],
      notes: [
        'Troubleshooting is #1 voice driver',
        'Genesis NLP bots: 22% containment → Sierra target: 40%+',
        'Equipment context from VCG required for accurate flows',
        'Error code 771 = signal loss (most common)'
      ]
    },
    Gateway: {
      name: 'MCP Gateway',
      fullName: 'DirecTV MCP Gateway (AWS)',
      description: 'Central orchestration layer hosted on AWS. Handles tool discovery, platform-based filtering, request routing, parallel orchestration, and response normalization. No LLM — deterministic only.',
      color: '#E056FD',
      icon: '⚡',
      latency: '<200ms total',
      sourceSystem: 'AWS (DirecTV Infrastructure)',
      apiGateway: 'Direct MCP Protocol',
      auth: {
        type: 'Platform Authentication',
        platformValidation: 'Client ID + Secret per platform',
        sessionValidation: 'Passed through to backend servers',
        auditLogging: 'All requests logged'
      },
      tools: [
        {
          name: 'list_tools',
          description: 'Returns available tools filtered by calling platform. Each platform sees only tools they have access to.',
          platformAccess: {
            sierra: { enabled: true, tools_visible: 7 },
            agentforce: { enabled: true, tools_visible: 8 },
            genesis: { enabled: true, tools_visible: 6 },
            copilot: { enabled: true, tools_visible: 6 }
          },
          schema: {
            name: 'list_tools',
            description: 'Discover available tools (filtered by platform)',
            parameters: {
              type: 'object',
              properties: {
                platform_id: { type: 'string', description: 'Authenticated platform identifier' }
              },
              required: ['platform_id']
            },
            returns: {
              tools: '[{ name, description, parameters }]'
            }
          }
        },
        {
          name: 'escalate_to_agent',
          description: 'Hand off conversation to human agent with full context transfer to DTV360.',
          platformAccess: {
            sierra: { enabled: true, rateLimit: 'unlimited' },
            agentforce: { enabled: false, reason: 'Already agent channel' },
            genesis: { enabled: true, rateLimit: 'unlimited' },
            copilot: { enabled: false, reason: 'Internal channel' }
          },
          schema: {
            name: 'escalate_to_agent',
            description: 'Transfer to human agent with context',
            parameters: {
              type: 'object',
              properties: {
                customer_id: { type: 'string' },
                conversation_summary: { type: 'string' },
                escalation_reason: { type: 'string', enum: ['customer_request', 'complex_issue', 'policy_exception', 'technical_failure'] },
                context_data: { type: 'object' }
              },
              required: ['customer_id', 'escalation_reason']
            },
            returns: {
              transfer_id: 'string',
              estimated_wait: 'string',
              queue_position: 'integer',
              context_transferred: 'boolean'
            }
          }
        }
      ],
      notes: [
        'No LLM in gateway — deterministic routing only',
        'Parallel orchestration for multi-server calls',
        'Single endpoint for all platforms — filter by platform_id',
        'All requests logged for audit trail'
      ]
    }
  };

  const toolDefinitions = {
    get_customer_profile: { name: 'get_customer_profile', server: 'VCG', type: 'read', latency: '~50ms', triggers: ['who is this', 'what services', 'my account', 'my plan', 'what do i have', 'my package'] },
    get_bill_history: { name: 'get_bill_history', server: 'Biller', type: 'read', latency: '~50ms', triggers: ['bill history', 'past bills', 'billing statements', 'payment history'] },
    compare_bills: { name: 'compare_bills', server: 'Biller', type: 'read', latency: '~100ms', triggers: ['why is my bill', 'bill higher', 'what changed', 'explain charges', 'bill went up', 'bill increased'] },
    get_offers: { name: 'get_offers', server: 'Offers', type: 'read', latency: '~50ms', triggers: ['deals', 'discounts', 'promotions', 'offers', 'save money', 'lower my bill'] },
    apply_offer: { name: 'apply_offer', server: 'Offers', type: 'write', latency: '~50ms', triggers: ['apply', 'add that', 'give me that', 'accept offer', 'take the deal', 'yes apply'] },
    get_troubleshooting_flow: { name: 'get_troubleshooting_flow', server: 'WFE', type: 'read', latency: '~50ms', triggers: ['not working', 'error', 'broken', 'fix', 'troubleshoot', 'help with', 'receiver', '771'] },
    schedule_technician: { name: 'schedule_technician', server: 'WFE', type: 'write', latency: '~50ms', triggers: ['technician', 'appointment', 'send someone', 'schedule visit'] },
    issue_credit: { name: 'issue_credit', server: 'Biller', type: 'write', latency: '~50ms', triggers: ['credit', 'refund', 'compensation', 'make it right'] },
    escalate_to_agent: { name: 'escalate_to_agent', server: 'Gateway', type: 'action', latency: '~10ms', triggers: ['talk to someone', 'human', 'agent', 'representative', 'supervisor'] }
  };

  const matchTool = (input) => {
    const lowerInput = input.toLowerCase();
    const platform = platforms[selectedPlatform];
    for (const [toolId, tool] of Object.entries(toolDefinitions)) {
      if (!platform.tools.includes(toolId)) continue;
      for (const trigger of tool.triggers) {
        if (lowerInput.includes(trigger)) return tool;
      }
    }
    return toolDefinitions.get_customer_profile;
  };

  const generateFlow = (tool) => {
    const flow = [
      { id: 'input', label: 'Query received', target: 'platform' },
      { id: 'llm', label: `LLM → ${tool.name}()`, target: 'platform' },
      { id: 'gateway', label: 'MCP Gateway (AWS)', target: 'gateway' },
    ];
    if (tool.server === 'Biller' && tool.name === 'compare_bills') {
      flow.push(
        { id: 'parallel', label: 'Parallel orchestration', target: 'gateway' },
        { id: 'vcg', label: 'VCG Server', target: 'VCG' },
        { id: 'biller', label: 'Biller Server', target: 'Biller' },
        { id: 'offers', label: 'Offers Server', target: 'Offers' },
      );
    } else {
      flow.push({ id: 'server', label: `${tool.server} Server`, target: tool.server });
    }
    flow.push(
      { id: 'mulesoft', label: 'MuleSoft API Gateway', target: 'mulesoft' },
      { id: 'source', label: 'Source Systems', target: 'source' },
      { id: 'response', label: 'Response returned', target: 'platform' }
    );
    return flow;
  };

  const generateResponse = (tool) => {
    const responses = {
      get_customer_profile: `**Customer Profile**\n\n• Account: Active (Satellite)\n• Package: Ultimate + Sports\n• Equipment: 3 Genie receivers\n• Customer since: March 2019\n• Biller System: biller_1\n• Status: Good standing`,
      get_bill_history: `**Bill History (6 months)**\n\n• Nov 2025: $142.50\n• Oct 2025: $142.50\n• Sep 2025: $142.50\n• Aug 2025: $127.50\n• Jul 2025: $127.50\n• Jun 2025: $127.50`,
      compare_bills: `**Bill Comparison**\n\nCurrent: $142.50 → Previous: $127.50\n**Change: +$15.00**\n\n**What changed:**\n• HBO Max promo expired: +$15.99\n• Regional sports fee increase: +$2.00\n• Loyalty credit applied: -$2.99\n\n_Would you like to see available offers?_`,
      get_offers: `**Available Offers**\n\n1. 🎬 **HBO Max** — $10/mo (50% off)\n2. 📺 **Sports Pack** — Free for 3 months\n3. 💰 **Loyalty Discount** — $10/mo off for 12 months\n\n_Say "apply" + offer name to add to your account._`,
      apply_offer: `**✓ Offer Applied**\n\nLoyalty Discount: -$10.00/mo\nEffective: Next billing cycle\nDuration: 12 months\n\n**New monthly total: $132.50**`,
      get_troubleshooting_flow: `**Troubleshooting: Receiver**\n\n**Step 1 of 4**\n\nPress and hold the red reset button on the side of your Genie for 10 seconds.\n\n• Is the receiver restarting? → Continue\n• No change? → We'll try another approach`,
      schedule_technician: `**✓ Technician Scheduled**\n\nDate: Tomorrow, Nov 29\nWindow: 2:00 PM - 4:00 PM\nConfirmation: #DTV-847291\n\n_You'll receive a text 30 min before arrival._`,
      issue_credit: `**✓ Credit Applied**\n\nAmount: $25.00\nReason: Service interruption\nApplied to: Next statement`,
      escalate_to_agent: `**Connecting to agent...**\n\nContext transferred:\n• Account status\n• Conversation history\n• Bill comparison\n\nEstimated wait: ~2 minutes`
    };
    return responses[tool.name] || 'Request processed.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessing) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setConversation(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);

    const tool = matchTool(userMessage);
    const flow = generateFlow(tool);
    setActiveFlow({ tool, steps: flow });
    setFlowStep(0);

    for (let i = 0; i < flow.length; i++) {
      await new Promise(r => setTimeout(r, 400));
      setFlowStep(i + 1);
    }

    await new Promise(r => setTimeout(r, 300));
    
    setConversation(prev => [...prev, {
      role: 'assistant',
      content: generateResponse(tool),
      meta: { tool: tool.name, server: tool.server, latency: tool.latency }
    }]);

    setIsProcessing(false);
    setTimeout(() => setActiveFlow(null), 1500);
  };

  const openServerModal = (serverKey) => {
    setModalContent({ type: 'server', data: serverDefinitions[serverKey], key: serverKey });
  };

  const quickActions = [
    "Why is my bill higher?",
    "What services do I have?",
    "My receiver isn't working",
    "What deals can you offer?"
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const currentPlatform = platforms[selectedPlatform];

  // Modal Component
  const Modal = ({ content, onClose }) => {
    if (!content) return null;
    const server = content.data;
    const [activeToolIdx, setActiveToolIdx] = useState(0);
    const activeTool = server.tools[activeToolIdx];

    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }} onClick={onClose}>
        <div style={{
          background: '#12121a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                <span style={{ fontSize: '24px' }}>{server.icon}</span>
                <span style={{ fontSize: '18px', fontWeight: 600, color: server.color }}>{server.name}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{server.fullName}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '8px', maxWidth: '600px', lineHeight: 1.5 }}>
                {server.description}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '16px'
            }}>×</button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
            {/* Security Section */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
                SECURITY & AUTH
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>AUTH TYPE</div>
                  <div style={{ fontSize: '10px', color: '#fff' }}>{server.auth.type}</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>API GATEWAY</div>
                  <div style={{ fontSize: '10px', color: '#fff' }}>{server.apiGateway}</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>TOKEN VALIDATION</div>
                  <div style={{ fontSize: '10px', color: '#fff' }}>{server.auth.tokenValidation || server.auth.platformValidation}</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>LATENCY</div>
                  <div style={{ fontSize: '10px', color: server.color }}>{server.latency}</div>
                </div>
              </div>
            </div>

            {/* Tools Section */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
                MCP TOOLS ({server.tools.length})
              </div>
              
              {/* Tool Tabs */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {server.tools.map((tool, idx) => (
                  <button
                    key={tool.name}
                    onClick={() => setActiveToolIdx(idx)}
                    style={{
                      padding: '6px 12px',
                      background: activeToolIdx === idx ? server.color : 'rgba(255,255,255,0.05)',
                      color: activeToolIdx === idx ? '#000' : 'rgba(255,255,255,0.6)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      fontWeight: activeToolIdx === idx ? 600 : 400
                    }}
                  >
                    {tool.name}
                  </button>
                ))}
              </div>

              {/* Active Tool Details */}
              {activeTool && (
                <div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '16px', lineHeight: 1.5 }}>
                    {activeTool.description}
                  </div>

                  {/* Platform Access - THE KEY PART */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>PLATFORM ACCESS (Part of MCP Schema)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      {Object.entries(activeTool.platformAccess).map(([platformKey, access]) => (
                        <div key={platformKey} style={{
                          padding: '10px 12px',
                          background: access.enabled ? `${platforms[platformKey].color}10` : 'rgba(255,60,60,0.05)',
                          border: `1px solid ${access.enabled ? platforms[platformKey].color + '40' : 'rgba(255,60,60,0.2)'}`,
                          borderRadius: '8px'
                        }}>
                          <div style={{ 
                            fontSize: '11px', 
                            fontWeight: 600, 
                            color: access.enabled ? platforms[platformKey].color : '#ff6b6b',
                            marginBottom: '4px'
                          }}>
                            {access.enabled ? '✓' : '✗'} {platforms[platformKey].name}
                          </div>
                          {access.enabled && access.rateLimit && (
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>
                              Rate: {access.rateLimit}
                            </div>
                          )}
                          {access.enabled && access.note && (
                            <div style={{ fontSize: '8px', color: platforms[platformKey].color, marginTop: '2px' }}>
                              {access.note}
                            </div>
                          )}
                          {access.enabled && access.tools_visible && (
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>
                              {access.tools_visible} tools visible
                            </div>
                          )}
                          {!access.enabled && access.reason && (
                            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                              {access.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Schema */}
                  <div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>MCP TOOL SCHEMA</div>
                    <pre style={{
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      padding: '16px',
                      fontSize: '10px',
                      color: '#00D4AA',
                      overflow: 'auto',
                      maxHeight: '220px',
                      lineHeight: 1.6,
                      margin: 0
                    }}>
{JSON.stringify(activeTool.schema, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {server.notes && server.notes.length > 0 && (
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
                  IMPLEMENTATION NOTES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {server.notes.map((note, idx) => (
                    <div key={idx} style={{
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.02)',
                      borderLeft: `2px solid ${server.color}40`,
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.7)'
                    }}>
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a0f 0%, #0d0d14 100%)',
      color: '#e4e4e7',
      fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        pointerEvents: 'none'
      }} />

      {/* Modal */}
      {modalContent && <Modal content={modalContent} onClose={() => setModalContent(null)} />}

      <header style={{
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(10,10,15,0.9)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '9px', letterSpacing: '2px', color: currentPlatform.color, fontWeight: 600 }}>
              DIRECTV × ALTIMETRIK
            </div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#fff' }}>
              MCP Architecture Explorer
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '8px' }}>
            {Object.entries(platforms).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setSelectedPlatform(key)}
                style={{
                  padding: '6px 12px',
                  fontSize: '10px',
                  background: selectedPlatform === key ? p.color : 'transparent',
                  color: selectedPlatform === key ? '#000' : 'rgba(255,255,255,0.5)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: selectedPlatform === key ? 600 : 400,
                  fontFamily: 'inherit',
                  transition: 'all 0.2s'
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>COMPARE</span>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '6px' }}>
            {['mcp', 'datalake'].map(m => (
              <button
                key={m}
                onClick={() => setComparisonMode(m)}
                style={{
                  padding: '4px 10px',
                  fontSize: '9px',
                  background: comparisonMode === m ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: comparisonMode === m ? '#fff' : 'rgba(255,255,255,0.4)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                {m === 'mcp' ? 'MCP' : 'Data Lake'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', position: 'relative', zIndex: 10 }}>
        
        <section style={{ padding: '24px', borderRight: '1px solid rgba(255,255,255,0.06)', overflow: 'auto' }}>
          
          {comparisonMode === 'mcp' ? (
            <>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
                  LIVE ARCHITECTURE — CLICK ANY COMPONENT FOR MCP SCHEMA
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                  {Object.entries(platforms).map(([key, p]) => {
                    const isActive = selectedPlatform === key;
                    const isFlowing = activeFlow && flowStep > 0 && isActive;
                    return (
                      <div
                        key={key}
                        onClick={() => setSelectedPlatform(key)}
                        style={{
                          padding: '10px 16px',
                          background: isActive ? `${p.color}15` : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isActive ? p.color + '40' : 'rgba(255,255,255,0.04)'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                          boxShadow: isFlowing ? `0 0 20px ${p.color}30` : 'none'
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 500, color: isActive ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{p.type}</div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  <div style={{
                    width: '2px',
                    height: '24px',
                    background: activeFlow && flowStep >= 2 
                      ? `linear-gradient(180deg, ${currentPlatform.color}, #E056FD)`
                      : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.3s'
                  }} />
                </div>

                <div
                  onClick={() => openServerModal('Gateway')}
                  style={{
                    padding: '16px 24px',
                    background: activeFlow && flowStep >= 2 ? 'rgba(224,86,253,0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${activeFlow && flowStep >= 2 ? '#E056FD40' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    boxShadow: activeFlow && flowStep >= 2 ? '0 0 30px rgba(224,86,253,0.2)' : 'none',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#E056FD', marginBottom: '4px' }}>
                    ⚡ MCP Gateway
                  </div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>
                    AWS-Hosted • Deterministic Routing • &lt;200ms latency
                  </div>
                  {activeFlow && (
                    <div style={{
                      marginTop: '8px',
                      padding: '4px 8px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '4px',
                      fontSize: '10px',
                      color: currentPlatform.color,
                      display: 'inline-block'
                    }}>
                      {activeFlow.tool.name}()
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  <div style={{
                    width: '2px',
                    height: '24px',
                    background: activeFlow && flowStep >= 3 ? '#E056FD' : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.3s'
                  }} />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                  {['VCG', 'Biller', 'Offers', 'WFE'].map(serverKey => {
                    const server = serverDefinitions[serverKey];
                    const isActive = activeFlow && (
                      activeFlow.tool.server === serverKey ||
                      (activeFlow.tool.name === 'compare_bills' && ['VCG', 'Biller', 'Offers'].includes(serverKey))
                    ) && flowStep >= 4;
                    
                    return (
                      <div
                        key={serverKey}
                        onClick={() => openServerModal(serverKey)}
                        style={{
                          padding: '12px 16px',
                          background: isActive ? `${server.color}15` : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isActive ? server.color + '40' : 'rgba(255,255,255,0.04)'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                          boxShadow: isActive ? `0 0 20px ${server.color}20` : 'none',
                          minWidth: '90px',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}>{server.icon}</div>
                        <div style={{ fontSize: '10px', fontWeight: 500, color: isActive ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                          {serverKey}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  <div style={{
                    width: '2px',
                    height: '24px',
                    background: activeFlow && flowStep >= 5 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.3s'
                  }} />
                </div>

                <div style={{
                  padding: '12px',
                  background: activeFlow && flowStep >= 5 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  marginBottom: '8px'
                }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>MuleSoft API Gateway</div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>OAuth 2.0 • ForgeRock IDP • Akamai WAF</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  <div style={{
                    width: '2px',
                    height: '24px',
                    background: activeFlow && flowStep >= 6 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'
                  }} />
                </div>

                <div style={{
                  padding: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Source Systems (Golden)</div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>3 Billers • VCG • Decisioning Engine • Workflow Engine</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
                  {currentPlatform.name.toUpperCase()} TOOLS ({currentPlatform.tools.length} of {Object.keys(toolDefinitions).length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {Object.entries(toolDefinitions).map(([key, tool]) => {
                    const hasAccess = currentPlatform.tools.includes(key);
                    const isActive = activeFlow?.tool.name === key;
                    return (
                      <div
                        key={key}
                        onClick={() => hasAccess && openServerModal(tool.server)}
                        style={{
                          padding: '10px',
                          background: isActive ? `${currentPlatform.color}15` : hasAccess ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)',
                          border: `1px solid ${isActive ? currentPlatform.color + '40' : 'rgba(255,255,255,0.04)'}`,
                          borderRadius: '6px',
                          opacity: hasAccess ? 1 : 0.3,
                          cursor: hasAccess ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontSize: '9px', fontWeight: 500, color: hasAccess ? '#fff' : 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>
                          {tool.name}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '8px',
                            padding: '1px 4px',
                            background: tool.type === 'write' ? 'rgba(255,107,53,0.2)' : tool.type === 'action' ? 'rgba(224,86,253,0.2)' : 'rgba(0,212,170,0.2)',
                            color: tool.type === 'write' ? '#FF6B35' : tool.type === 'action' ? '#E056FD' : '#00D4AA',
                            borderRadius: '3px'
                          }}>
                            {tool.type}
                          </span>
                          <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>{tool.server}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div>
              <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
                WHY NOT DATA LAKE?
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{
                  padding: '20px',
                  background: 'rgba(255,60,60,0.05)',
                  border: '1px solid rgba(255,60,60,0.2)',
                  borderRadius: '12px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#ff6b6b', marginBottom: '12px' }}>
                    ❌ Data Lake / Snowflake
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                    <div style={{ marginBottom: '8px' }}>• <strong>24hr latency</strong> — Snowflake runs behind</div>
                    <div style={{ marginBottom: '8px' }}>• <strong>Replication burden</strong> — "Will get into trouble" — Sumit</div>
                    <div style={{ marginBottom: '8px' }}>• <strong>Multiple truths</strong> — "Minimize alternate truth" — Miles</div>
                    <div style={{ marginBottom: '8px' }}>• <strong>Read-only</strong> — Can't support transactions</div>
                    <div>• <strong>Per-platform work</strong> — Each AI needs custom integration</div>
                  </div>
                </div>

                <div style={{
                  padding: '20px',
                  background: 'rgba(0,212,170,0.05)',
                  border: '1px solid rgba(0,212,170,0.2)',
                  borderRadius: '12px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#00D4AA', marginBottom: '12px' }}>
                    ✓ MCP Gateway via APIs
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                    <div style={{ marginBottom: '8px' }}>• <strong>Real-time</strong> — Direct API access via MuleSoft</div>
                    <div style={{ marginBottom: '8px' }}>• <strong>No replication</strong> — Uses existing API infrastructure</div>
                    <div style={{ marginBottom: '8px' }}>• <strong>Golden sources</strong> — VCG, Billers stay authoritative</div>
                    <div style={{ marginBottom: '8px' }}>• <strong>Read + Write</strong> — Transactional capabilities (2026)</div>
                    <div>• <strong>Build once</strong> — Sierra, Agent Force, Genesis share gateway</div>
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: '24px',
                padding: '16px',
                background: 'rgba(224,86,253,0.05)',
                border: '1px solid rgba(224,86,253,0.2)',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '11px', color: '#E056FD', fontStyle: 'italic' }}>
                  "We want to minimize any alternate truth for the data" — Miles
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
                  HEAD-TO-HEAD COMPARISON
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: '8px', textAlign: 'left', color: 'rgba(255,255,255,0.5)' }}>Criterion</th>
                      <th style={{ padding: '8px', textAlign: 'center', color: '#ff6b6b' }}>Snowflake</th>
                      <th style={{ padding: '8px', textAlign: 'center', color: '#00D4AA' }}>MCP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Data Freshness', '24-hour lag', 'Real-time'],
                      ['Maintenance', 'Sync issues', 'None'],
                      ['Source of Truth', 'Creates alternate', 'Preserves golden'],
                      ['Transactions', 'Read-only', 'Read + Write'],
                      ['Multi-Platform', 'Separate per platform', 'Single gateway'],
                      ['Time to Value', 'Long', 'Fast'],
                    ].map(([criterion, lake, mcp], i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '8px', color: 'rgba(255,255,255,0.7)' }}>{criterion}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>{lake}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#00D4AA' }}>{mcp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: currentPlatform.color
            }} />
            <span style={{ fontSize: '11px', fontWeight: 500 }}>{currentPlatform.name} Simulator</span>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>
              {currentPlatform.type}
            </span>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {conversation.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
                  Type a customer query to see the architecture in action
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {quickActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => setChatInput(action)}
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '8px',
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        transition: 'all 0.2s'
                      }}
                    >
                      "{action}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {conversation.map((msg, i) => (
              <div
                key={i}
                style={{
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  padding: '12px 14px',
                  background: msg.role === 'user' ? currentPlatform.color : 'rgba(255,255,255,0.05)',
                  color: msg.role === 'user' ? '#000' : '#fff',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  maxWidth: '90%',
                  fontSize: '11px',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>
                {msg.meta && (
                  <div style={{
                    marginTop: '4px',
                    fontSize: '9px',
                    color: 'rgba(255,255,255,0.4)',
                    display: 'flex',
                    gap: '8px'
                  }}>
                    <span style={{ color: currentPlatform.color }}>{msg.meta.tool}()</span>
                    <span>→ {msg.meta.server}</span>
                    <span>{msg.meta.latency}</span>
                  </div>
                )}
              </div>
            ))}

            {isProcessing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: currentPlatform.color,
                  animation: 'pulse 1s infinite'
                }} />
                {activeFlow && flowStep < activeFlow.steps.length 
                  ? activeFlow.steps[flowStep]?.label 
                  : 'Processing...'}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                placeholder="Type a customer query..."
                disabled={isProcessing}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={isProcessing || !chatInput.trim()}
                style={{
                  padding: '12px 20px',
                  background: currentPlatform.color,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing || !chatInput.trim() ? 0.5 : 1,
                  fontFamily: 'inherit'
                }}
              >
                Send
              </button>
            </div>
          </div>
        </section>
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        input::placeholder {
          color: rgba(255,255,255,0.3);
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
