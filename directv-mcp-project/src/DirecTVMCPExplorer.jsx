import { useState, useEffect, useRef } from 'react';

export default function DirecTVMCPExplorer() {
  const [selectedPlatform, setSelectedPlatform] = useState('sierra');
  const [chatInput, setChatInput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFlow, setActiveFlow] = useState(null);
  const [flowStep, setFlowStep] = useState(0);
  const [selectedComponent, setSelectedComponent] = useState(null);
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
      description: 'Full capabilities for human agents'
    },
    genesis: {
      name: 'Genesis',
      type: 'Voice',
      stats: { monthly: '3.5M', containment: '22%' },
      color: '#7B68EE',
      tools: ['get_customer_profile', 'get_bill_history', 'compare_bills', 'get_offers', 'get_troubleshooting_flow', 'escalate_to_agent'],
      description: 'Voice IVR - read-only until validated'
    },
    copilot: {
      name: 'Copilot',
      type: 'Internal',
      stats: { status: 'Future' },
      color: '#FFD93D',
      tools: ['get_customer_profile', 'get_bill_history', 'compare_bills', 'get_offers', 'get_troubleshooting_flow', 'schedule_technician'],
      description: 'Future internal tools and dashboards'
    }
  };

  const toolDefinitions = {
    get_customer_profile: {
      name: 'get_customer_profile',
      description: 'Retrieve customer info, services, packages, equipment, and account status',
      server: 'VCG',
      type: 'read',
      latency: '~50ms',
      triggers: ['who is this', 'what services', 'my account', 'my plan', 'what do i have', 'my package']
    },
    get_bill_history: {
      name: 'get_bill_history',
      description: 'Retrieve 6-month billing history with line-item details',
      server: 'Biller',
      type: 'read',
      latency: '~50ms',
      triggers: ['bill history', 'past bills', 'billing statements', 'payment history']
    },
    compare_bills: {
      name: 'compare_bills',
      description: 'Compare current bill to previous - promos, rate changes, usage, fees',
      server: 'Multi',
      type: 'read',
      latency: '~100ms',
      triggers: ['why is my bill', 'bill higher', 'what changed', 'explain charges', 'bill went up', 'bill increased']
    },
    get_offers: {
      name: 'get_offers',
      description: 'Get real-time eligible offers and promotions for customer',
      server: 'Offers',
      type: 'read',
      latency: '~50ms',
      triggers: ['deals', 'discounts', 'promotions', 'offers', 'save money', 'lower my bill']
    },
    apply_offer: {
      name: 'apply_offer',
      description: 'Apply an offer to customer account - transactional write-back',
      server: 'Offers',
      type: 'write',
      latency: '~50ms',
      triggers: ['apply', 'add that', 'give me that', 'accept offer', 'take the deal', 'yes apply']
    },
    get_troubleshooting_flow: {
      name: 'get_troubleshooting_flow',
      description: 'Get guided diagnostic flow for equipment issues and error codes',
      server: 'WFE',
      type: 'read',
      latency: '~50ms',
      triggers: ['not working', 'error', 'broken', 'fix', 'troubleshoot', 'help with', 'receiver', '771']
    },
    schedule_technician: {
      name: 'schedule_technician',
      description: 'Book a service technician appointment',
      server: 'WFE',
      type: 'write',
      latency: '~50ms',
      triggers: ['technician', 'appointment', 'send someone', 'schedule visit']
    },
    issue_credit: {
      name: 'issue_credit',
      description: 'Apply account credit for service issues',
      server: 'Biller',
      type: 'write',
      latency: '~50ms',
      triggers: ['credit', 'refund', 'compensation', 'make it right']
    },
    escalate_to_agent: {
      name: 'escalate_to_agent',
      description: 'Hand off conversation to human agent with full context',
      server: 'Gateway',
      type: 'action',
      latency: '~10ms',
      triggers: ['talk to someone', 'human', 'agent', 'representative', 'supervisor']
    }
  };

  const servers = {
    VCG: { name: 'VCG Server', fullName: 'Video Customer Gateway', description: 'Customer profile, packages, equipment, account status', color: '#00D4AA', icon: '👤' },
    Biller: { name: 'Biller Server', fullName: '3 Billing Systems', description: 'Bill history, comparisons, payment status, credits', color: '#FF6B35', icon: '💳' },
    Offers: { name: 'Offers Server', fullName: 'Decisioning Engine', description: 'Real-time eligibility, offer application', color: '#7B68EE', icon: '🎁' },
    WFE: { name: 'WFE Server', fullName: 'Workflow Engine', description: 'Device troubleshooting, diagnostics', color: '#FFD93D', icon: '🔧' },
    Gateway: { name: 'MCP Gateway', fullName: 'AWS-Hosted Gateway', description: 'Tool routing, platform filtering, orchestration', color: '#E056FD', icon: '⚡' },
    Multi: { name: 'Parallel Calls', fullName: 'Multi-Server Orchestration', description: 'VCG + Biller + Offers in parallel', color: '#E056FD', icon: '⚡' }
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
    if (tool.server === 'Multi') {
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
      get_customer_profile: `**Customer Profile**\n\n• Account: Active (Satellite)\n• Package: Ultimate + Sports\n• Equipment: 3 Genie receivers\n• Customer since: March 2019\n• Status: Good standing`,
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
  const availableTools = currentPlatform.tools.map(t => toolDefinitions[t]);

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
                  LIVE ARCHITECTURE — CLICK ANY COMPONENT
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                  {Object.entries(platforms).map(([key, p]) => {
                    const isActive = selectedPlatform === key;
                    const isFlowing = activeFlow && flowStep > 0 && isActive;
                    return (
                      <div
                        key={key}
                        onClick={() => { setSelectedPlatform(key); setSelectedComponent({ type: 'platform', data: p }); }}
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
                  onClick={() => setSelectedComponent({ type: 'server', data: servers.Gateway })}
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
                    const server = servers[serverKey];
                    const isActive = activeFlow && (
                      activeFlow.tool.server === serverKey ||
                      (activeFlow.tool.server === 'Multi' && ['VCG', 'Biller', 'Offers'].includes(serverKey))
                    ) && flowStep >= 4;
                    
                    return (
                      <div
                        key={serverKey}
                        onClick={() => setSelectedComponent({ type: 'server', data: server })}
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
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>Existing Security • Tokens • Rate Limiting</div>
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
                  {currentPlatform.name.toUpperCase()} TOOLS ({availableTools.length} of {Object.keys(toolDefinitions).length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {Object.entries(toolDefinitions).map(([key, tool]) => {
                    const hasAccess = currentPlatform.tools.includes(key);
                    const isActive = activeFlow?.tool.name === key;
                    return (
                      <div
                        key={key}
                        onClick={() => hasAccess && setSelectedComponent({ type: 'tool', data: tool })}
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

              {selectedComponent && (
                <div style={{
                  marginTop: '16px',
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>
                      {selectedComponent.data.name || selectedComponent.data.fullName}
                    </div>
                    <button
                      onClick={() => setSelectedComponent(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: 0
                      }}
                    >×</button>
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                    {selectedComponent.data.description}
                  </div>
                  {selectedComponent.data.latency && (
                    <div style={{ marginTop: '8px', fontSize: '9px', color: currentPlatform.color }}>
                      Latency: {selectedComponent.data.latency}
                    </div>
                  )}
                </div>
              )}
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
                    ❌ Data Lake Approach
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                    <div style={{ marginBottom: '8px' }}>• <strong>24hr latency</strong> — Snowflake runs behind</div>
                    <div style={{ marginBottom: '8px' }}>• <strong>Replication burden</strong> — Sync failures = support load</div>
                    <div style={{ marginBottom: '8px' }}>• <strong>Multiple truths</strong> — Data drift from golden sources</div>
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
                    ✓ MCP Gateway Approach
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                    <div style={{ marginBottom: '8px' }}>• <strong>Real-time</strong> — Direct API access to sources</div>
                    <div style={{ marginBottom: '8px' }}>• <strong>No replication</strong> — Uses existing MuleSoft APIs</div>
                    <div style={{ marginBottom: '8px' }}>• <strong>Golden sources</strong> — VCG, Billers stay authoritative</div>
                    <div style={{ marginBottom: '8px' }}>• <strong>Read + Write</strong> — Transactional capabilities</div>
                    <div>• <strong>Build once</strong> — All platforms share same gateway</div>
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
                      <th style={{ padding: '8px', textAlign: 'center', color: '#ff6b6b' }}>Data Lake</th>
                      <th style={{ padding: '8px', textAlign: 'center', color: '#00D4AA' }}>MCP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Data Freshness', '24-hour lag', 'Real-time'],
                      ['Maintenance', 'Ongoing sync', 'None'],
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
